import json
from datetime import datetime, timezone
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import async_session
from app.models import User, Video, VideoStats, VideoContent, Query, QueryVideo
from app.services.bilibili import BilibiliClient


async def run_fetch(query_id: int, uid: int, start_date, end_date, sessdata: str | None):
    """Background task: fetch all video data for a query."""
    async with async_session() as db:
        query = await db.get(Query, query_id)
        if not query:
            return
        try:
            client = BilibiliClient(sessdata=sessdata)

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
            all_videos = []
            page = 1
            while True:
                result = await client.get_video_list(uid, page=page)
                for v in result["videos"]:
                    pub_ts = v.get("created", 0)
                    pub_date = datetime.fromtimestamp(pub_ts, tz=timezone.utc).date()
                    if start_date <= pub_date <= end_date:
                        all_videos.append(v)
                if page * 50 >= result["total"]:
                    break
                # Early exit if we've passed the date range
                if result["videos"]:
                    oldest_ts = min(v.get("created", 0) for v in result["videos"])
                    if datetime.fromtimestamp(oldest_ts, tz=timezone.utc).date() < start_date:
                        break
                page += 1

            total = len(all_videos)
            query.video_count = total
            await db.commit()

            # Step 3: Fetch details for each video
            for i, v in enumerate(all_videos, 1):
                query.progress = f"Fetching video {i}/{total}"
                await db.commit()

                bvid = v["bvid"]
                detail = await client.get_video_detail(bvid)

                # Upsert Video
                existing = await db.get(Video, bvid)
                if not existing:
                    video = Video(
                        bvid=bvid, aid=detail["aid"], cid=detail["cid"],
                        uid=uid, title=detail["title"],
                        description=detail["description"],
                        cover_url=detail["cover_url"], duration=detail["duration"],
                        published_at=datetime.fromtimestamp(detail["published_at"], tz=timezone.utc),
                        tags=detail["tags"],
                    )
                    db.add(video)
                else:
                    existing.title = detail["title"]
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

            # Step 4: Fetch content
            query.status = "fetching_content"
            await db.commit()

            for i, v in enumerate(all_videos, 1):
                query.progress = f"Fetching content {i}/{total}"
                await db.commit()

                bvid = v["bvid"]
                video = await db.get(Video, bvid)
                aid = video.aid
                cid = video.cid

                comments = await client.get_comments(aid) if aid else []
                danmakus = await client.get_danmakus(cid) if cid else []
                subtitle = await client.get_subtitle(bvid, cid) if cid else ""

                db.add(VideoContent(
                    bvid=bvid,
                    comments=json.dumps(comments, ensure_ascii=False),
                    danmakus=json.dumps(danmakus, ensure_ascii=False),
                    subtitle=subtitle,
                ))
                await db.commit()

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

        except Exception as e:
            query.status = "error"
            query.error_message = str(e)
            await db.commit()
