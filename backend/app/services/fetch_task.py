import asyncio
import json
import logging
import random
from datetime import datetime, timezone
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import async_session
from app.models import User, Video, VideoStats, VideoContent, Query, QueryVideo
from app.services.bilibili import BilibiliClient
from app.services.sentiment_task import run_sentiment_analysis

logger = logging.getLogger(__name__)

# Batch processing config to avoid detection
BATCH_SIZE = 15  # Process 15 videos per batch
BATCH_BREAK_MIN = 8  # Min seconds between batches
BATCH_BREAK_MAX = 15  # Max seconds between batches


async def _upsert_video_content(
    db: AsyncSession,
    bvid: str,
    comments: list[dict],
    danmakus: list[str],
    subtitle: str,
) -> None:
    existing = (
        await db.execute(select(VideoContent).where(VideoContent.bvid == bvid))
    ).scalar_one_or_none()
    comments_json = json.dumps(comments, ensure_ascii=False)
    danmakus_json = json.dumps(danmakus, ensure_ascii=False)
    fetched_at = datetime.now(timezone.utc)

    if existing:
        existing.comments = comments_json
        existing.danmakus = danmakus_json
        existing.subtitle = subtitle
        existing.fetched_at = fetched_at
        return

    db.add(VideoContent(
        bvid=bvid,
        comments=comments_json,
        danmakus=danmakus_json,
        subtitle=subtitle,
        fetched_at=fetched_at,
    ))


async def run_fetch(query_id: int, uid: int, start_date, end_date, sessdata: str | None, proxy_urls: list[str] | None = None):
    """Background task: fetch all video data for a query."""
    async with async_session() as db:
        query = await db.get(Query, query_id)
        if not query:
            return
        client = BilibiliClient(sessdata=sessdata, proxy_urls=proxy_urls)
        try:
            # Step 1: Fetch user info
            query.status = "fetching"
            query.progress = "Fetching user info..."
            await db.commit()

            user_info = await client.get_user_info(uid)
            existing_user = await db.get(User, uid)
            if existing_user:
                existing_user.name = user_info["name"]
                existing_user.avatar_url = user_info["avatar_url"]
                existing_user.last_fetched_at = datetime.now(timezone.utc)
            else:
                db.add(User(uid=uid, name=user_info["name"],
                           avatar_url=user_info["avatar_url"],
                           last_fetched_at=datetime.now(timezone.utc)))
            query.user_name = user_info["name"]
            await db.commit()

            # Step 2: Fetch video list
            video_index = await client.get_video_index_in_range(uid, start_date, end_date)
            all_videos = []
            for v in video_index["videos"]:
                pub_ts = int(v.get("published_ts") or v.get("created") or 0)
                if pub_ts <= 0:
                    continue
                pub_date = datetime.fromtimestamp(pub_ts, tz=timezone.utc).date()
                if start_date <= pub_date <= end_date:
                    all_videos.append(v)

            total = len(all_videos)
            query.video_count = total
            await db.commit()

            # Step 3: Fetch details for each video (with batch breaks)
            subtitle_flags = {}  # bvid -> bool, from /view API's subtitle.list
            for i, v in enumerate(all_videos, 1):
                query.progress = f"Fetching video {i}/{total}"
                await db.commit()

                bvid = v["bvid"]
                detail = await client.get_video_detail(bvid)
                if detail.get("is_live_replay"):
                    logger.info("Skipping live replay video %s", bvid)
                    continue
                subtitle_flags[bvid] = detail.get("has_subtitle", False)

                # Upsert Video
                published_at = datetime.fromtimestamp(detail["published_at"], tz=timezone.utc)
                existing = await db.get(Video, bvid)
                if not existing:
                    video = Video(
                        bvid=bvid, aid=detail["aid"], cid=detail["cid"],
                        uid=uid, title=detail["title"],
                        description=detail["description"],
                        cover_url=detail["cover_url"], duration=detail["duration"],
                        published_at=published_at,
                        tags=detail["tags"],
                    )
                    db.add(video)
                else:
                    existing.aid = detail["aid"]
                    existing.cid = detail["cid"]
                    existing.title = detail["title"]
                    existing.description = detail["description"]
                    existing.cover_url = detail["cover_url"]
                    existing.duration = detail["duration"]
                    existing.published_at = published_at
                    existing.tags = detail["tags"]
                    existing.updated_at = datetime.now(timezone.utc)

                # Add stats snapshot
                s = detail["stats"]
                db.add(VideoStats(
                    bvid=bvid, views=s["views"], likes=s["likes"],
                    coins=s["coins"], favorites=s["favorites"],
                    shares=s["shares"], danmaku_count=s["danmaku_count"],
                    comment_count=s["comment_count"],
                ))

                # Link to query
                db.add(QueryVideo(query_id=query_id, bvid=bvid))
                await db.commit()

                # Batch break: pause after every BATCH_SIZE videos
                if i % BATCH_SIZE == 0 and i < total:
                    break_time = random.uniform(BATCH_BREAK_MIN, BATCH_BREAK_MAX)
                    logger.info("Batch break after %d videos, pausing for %.1fs", i, break_time)
                    await asyncio.sleep(break_time)

            query.status = "fetching_content"
            await db.commit()

            # Step 4: Fetch content (with batch breaks)

            for i, v in enumerate(all_videos, 1):
                query.progress = f"Fetching content {i}/{total}"
                await db.commit()

                bvid = v["bvid"]
                video = await db.get(Video, bvid)
                aid = video.aid
                cid = video.cid

                comments = await client.get_comments(aid) if aid else []
                danmakus = await client.get_danmakus(cid) if cid else []
                # Only fetch subtitle if /view API confirmed the video has one;
                # player/v2 has a known bug where it returns random other videos' subtitles
                has_sub = subtitle_flags.get(bvid, False)
                subtitle = ""
                if has_sub and aid and cid:
                    subtitle = await client.get_subtitle(bvid, aid, cid)

                await _upsert_video_content(
                    db=db,
                    bvid=bvid,
                    comments=comments,
                    danmakus=danmakus,
                    subtitle=subtitle,
                )
                await db.commit()

                # Batch break: pause after every BATCH_SIZE videos
                if i % BATCH_SIZE == 0 and i < total:
                    break_time = random.uniform(BATCH_BREAK_MIN, BATCH_BREAK_MAX)
                    logger.info("Batch break after %d content fetches, pausing for %.1fs", i, break_time)
                    await asyncio.sleep(break_time)

            # Step 5: Compute aggregates
            stmt = (select(VideoStats)
                    .join(QueryVideo, QueryVideo.bvid == VideoStats.bvid)
                    .where(QueryVideo.query_id == query_id))
            result = await db.execute(stmt)
            stats_list = result.scalars().all()

            # Use latest stats per video
            latest: dict[str, VideoStats] = {}
            for s in stats_list:
                if s.bvid not in latest or s.fetched_at > latest[s.bvid].fetched_at:
                    latest[s.bvid] = s

            query.total_views = sum(s.views for s in latest.values())
            query.total_likes = sum(s.likes for s in latest.values())
            query.total_coins = sum(s.coins for s in latest.values())
            query.total_favorites = sum(s.favorites for s in latest.values())
            query.total_shares = sum(s.shares for s in latest.values())
            query.total_danmaku = sum(s.danmaku_count for s in latest.values())
            query.total_comments = sum(s.comment_count for s in latest.values())
            query.status = "done"
            query.progress = None
            await db.commit()

            # Kick off sentiment analysis in background
            asyncio.create_task(run_sentiment_analysis(query_id))

        except Exception as e:
            logger.exception("Fetch task failed for query %s: %s", query_id, e)
            query.status = "error"
            query.error_message = str(e)
            await db.commit()
        finally:
            await client.aclose()
