"""Seed the local database with fictional demo data.

A freshly cloned repo cannot scrape anything at all: ``x/web-interface/view``
answers HTTP 412 without a logged-in session, so every run dies on the first
video, and ``get_danmakus``/``get_subtitle`` return empty even when it does not.
Without this seed the app is an empty shell. This script fabricates one full
query's worth of content
(comments, danmaku, subtitles) for a clearly fictional creator, then runs the
real SnowNLP sentiment pipeline over it, so every dashboard, video-detail,
word-table and sentiment endpoint has something meaningful to render.

Usage (from the backend/ directory, with dependencies installed):

    python scripts/seed_demo.py            # seed once; no-op if already seeded
    python scripts/seed_demo.py --reset    # delete existing demo data and reseed

All rows are tied to one obviously-fake UID (see DEMO_UID below) and can be
removed at any time via --reset, or by deleting the demo query from the UI.
"""
import argparse
import asyncio
import json
import random
import sys
from collections import defaultdict
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

# Windows consoles often default to a non-UTF-8 codepage (e.g. cp950/cp936),
# which can't encode the Chinese demo text this script prints.
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

from sqlalchemy import select  # noqa: E402

from app.core.config import settings  # noqa: E402
from app.core.database import async_session, init_db  # noqa: E402
from app.models import Query, QueryVideo, User, Video, VideoContent, VideoStats  # noqa: E402
from app.models.sentiment import VideoSentiment  # noqa: E402
from app.services.sentiment import get_analyzer  # noqa: E402
from app.services.sentiment_task import _analyze_items, _compute_aggregates  # noqa: E402
from app.services.wordcloud_svc import normalize_items  # noqa: E402

# Fixed seed so re-running (without --reset) produces byte-identical data —
# demo data should be reproducible, not different on every machine/run.
RNG_SEED = 20260831

# Obviously-fake identity: not a real Bilibili UID, and the display name says
# "demo account" outright so nobody mistakes this for a real creator.
DEMO_UID = 9999900001
DEMO_USER_NAME = "陈万能的实验室（演示账号）"
DEMO_AVATAR = "https://i0.hdslb.com/bfs/face/member/noface.jpg"


class Persona:
    __slots__ = ("uid", "name", "gender", "level", "vip_status", "vip_type", "location")

    def __init__(self, uid, name, gender, level, vip_status, vip_type, location):
        self.uid = uid
        self.name = name
        self.gender = gender
        self.level = level
        self.vip_status = vip_status
        self.vip_type = vip_type
        self.location = location


# 15 fictional commenter/danmaku-sender personas with varied gender/level/VIP/
# location so the demographics panel and sentiment-by-demographic matrix have
# real spread instead of a single flat bucket.
PERSONAS = [
    Persona(200001, "拿铁不加糖", "女", 4, 1, 2, "广东"),
    Persona(200002, "咸鱼翻身中", "男", 5, 0, 0, "北京"),
    Persona(200003, "西红柿炒蛋", "保密", 2, 0, 0, "四川"),
    Persona(200004, "深夜码字人", "男", 6, 1, 1, "上海"),
    Persona(200005, "小杨不爱吃香菜", "女", 3, 0, 0, "浙江"),
    Persona(200006, "电容爆炸现场", "男", 5, 1, 2, "江苏"),
    Persona(200007, "路过的工程喵", "女", 4, 0, 0, "湖北"),
    Persona(200008, "只会拧螺丝", "男", 1, 0, 0, "河南"),
    Persona(200009, "凌晨三点的电烙铁", "男", 6, 1, 2, "广东"),
    Persona(200010, "奶茶第一杯半价", "女", 2, 0, 0, "福建"),
    Persona(200011, "假装很懂电路", "保密", 3, 0, 0, "陕西"),
    Persona(200012, "退役实验室小白鼠", "男", 5, 1, 1, "辽宁"),
    Persona(200013, "隔壁老王的猫", "女", 4, 0, 0, "山东"),
    Persona(200014, "一个没有感情的点赞机器", "男", 6, 1, 2, "重庆"),
    Persona(200015, "萌新求带", "女", 1, 0, 0, "云南"),
]

TAG_POOL = [
    "DIY", "手工", "极客", "生活黑客", "测评", "改造", "开箱", "维修",
    "教程", "沙雕", "翻车现场", "废物利用", "电子", "冷知识", "居家",
]

TITLES = [
    "用微波炉的零件做了一台空气炸锅",
    "花三天把十年前的老风扇改造成静音款",
    "拆解一台祖传录音机,里面全是惊喜",
    "把废旧键盘做成了一个机械键盘台灯",
    "自制水冷散热器,压不住我也认了",
    "花两百块挑战复刻一台咖啡机",
    "把旧手机改造成监控摄像头教程",
    "用3D打印机修好了朋友的破椅子",
    "拆开十年前买的假货充电宝,后果自负",
    "自己动手做了一个能语音控制的台灯",
    "把废弃自行车轮做成了一台发电机",
    "花一下午修好了漏水二十年的老水龙头",
    "用纸箱做了一台能用的投影仪",
    "改造老式收音机,塞进了蓝牙模块",
    "自制小型风力发电装置全过程记录",
    "把坏掉的显示器拆了看看里面长什么样",
    "用乐高零件拼了一个能动的机械臂",
    "花一整天给旧笔记本换了固态硬盘",
    "自制简易3D打印机,成本不到五百",
    "把废旧空调外机改造成小冰箱",
    "拆解网红榨汁机,测测到底值不值",
    "用面包板搭了一个会眨眼的电子猫",
    "改造老年手机,加装了紧急呼叫按钮",
    "自己动手接了一整套智能家居开关",
    "把旧吉他音箱改成了蓝牙音响",
    "花一周时间给猫做了一个自动喂食器",
    "拆开十年前的诺基亚,居然还能开机",
    "自制简易电动滑板车测试全过程",
    "把废旧显卡改造成了一个暖手宝",
    "用锡纸和电池做了一个应急手电筒",
    "改造老式缝纫机,变成了自动版本",
    "花一下午修好了朋友的机械键盘",
    "自制小型温室,冬天也能种菜",
    "拆解共享单车锁,看看到底多难破解",
    "用旧路由器搭了一个迷你NAS",
    "把废旧木板做成了一整面工具墙",
    "自制简易空气净化器,效果测试",
    "改造老旧台灯,加了无线充电底座",
    "花两天时间给房间做了隐藏布线",
    "拆开十年前的老式电视,内部很震撼",
    "自制简易机械键盘轴体测试台",
    "把废弃洗衣机电机改造成了小风扇",
    "用手机零件拼了一个能用的对讲机",
    "改造老式自行车,加装了电助力",
    "自制迷你气象站,在家也能测天气",
    "花一整天给旧电脑主机做静音改造",
    "拆解网红加湿器,内部结构大公开",
    "用废旧齿轮做了一个机械时钟",
    "把旧显示器改造成了触控一体机",
    "自制简易过滤水壶,效果实测",
    "改造老式风扇,加装了定时和遥控",
]

POSITIVE_COMMENTS = [
    "这也太强了吧,一整个惊呆!",
    "UP主的动手能力永远是天花板",
    "这期质量绝了,一键三连走一波",
    "看完立刻下单材料,今晚就干",
    "构思太巧妙了,爱了爱了",
    "这才是硬核科技区该有的样子",
    "从头看到尾一点没快进,太上头了",
    "这个改造思路直接封神",
    "已经催更半年了,这更新爱了",
    "细节拉满,剪辑也很舒服",
    "笑死我了但是真的很厉害",
    "这波操作直接跪了",
    "这也能想到,思路太野了",
    "看完感觉自己也能顺手一试",
]

NEUTRAL_COMMENTS = [
    "坐等下一期",
    "这个成本大概多少啊",
    "求链接,材料在哪买的",
    "路过冒个泡",
    "已经是第二遍看了",
    "这个思路我记下了",
    "感觉可以出个教程",
    "支持一下,继续加油",
    "这个和上次那期有点像",
    "先收藏了,以后用得上",
]

NEGATIVE_COMMENTS = [
    "感觉这期节奏有点拖",
    "这个方案好像不太靠谱吧",
    "标题党了,和想象的不一样",
    "音量忽大忽小,听着难受",
    "这操作太危险了,不建议模仿",
    "感觉不如上一期用心",
    "这波是不是有点翻车",
    "剪辑有点乱,看得云里雾里",
    "这个价格属实有点劝退",
    "有点标题夸张了,内容一般",
]

POSITIVE_DANMAKU = [
    "666", "太强了", "这也行?!", "泪目", "前排==", "牛逼",
    "这创意绝了", "已三连", "笑不活了", "这波稳了", "神了",
]

NEUTRAL_DANMAKU = [
    "路过", "打卡", "催更", "坐等结果", "第几次看了", "这里暂停一下",
    "记笔记", "这个可以",
]

NEGATIVE_DANMAKU = [
    "有点尴尬", "不如别做了", "翻车预定", "这里怎么感觉怪怪的",
    "别学别学", "这也太糊了", "有点危险啊",
]

SUBTITLE_VERDICTS = [
    "确实值得一试", "效果比想象中好", "有点翻车但值得记录",
    "性价比拉满", "翻车了但是过程很有意思", "成功率比预期高不少",
]


def _gen_duration(rng: random.Random) -> int:
    """Mix of shorts / standard / long-form so the duration chart isn't flat."""
    bucket = rng.choices(["short", "standard", "long"], weights=[2, 5, 3])[0]
    if bucket == "short":
        return rng.randint(45, 180)
    if bucket == "standard":
        return rng.randint(300, 900)
    return rng.randint(1000, 3600)


def _gen_views(rng: random.Random) -> int:
    """Log-ish spread so a handful of videos read as breakout hits on the scatter plot."""
    tier = rng.choices(["normal", "hit", "viral"], weights=[7, 2, 1])[0]
    if tier == "normal":
        return rng.randint(2_000, 60_000)
    if tier == "hit":
        return rng.randint(60_000, 300_000)
    return rng.randint(300_000, 1_500_000)


def _weighted_hour(rng: random.Random) -> int:
    """Light mornings, a lunch bump, a strong evening peak — a believable publish-hour density."""
    weights = [1, 1, 1, 1, 1, 1, 2, 3, 4, 5, 6, 8, 9, 7, 6, 6, 7, 8, 10, 12, 11, 9, 6, 3]
    return rng.choices(range(24), weights=weights, k=1)[0]


def _gen_publish_dates(rng: random.Random, count: int, start: date, end: date) -> list[datetime]:
    span_days = (end - start).days
    offsets = sorted(rng.sample(range(span_days + 1), k=count))
    dates = []
    for offset in offsets:
        day = start + timedelta(days=offset)
        hour = _weighted_hour(rng)
        minute = rng.randint(0, 59)
        dates.append(datetime(day.year, day.month, day.day, hour, minute, tzinfo=timezone.utc))
    return dates


def _gen_comments(rng: random.Random, count: int) -> list[dict]:
    items = []
    for _ in range(count):
        persona = rng.choice(PERSONAS)
        bucket = rng.choices([POSITIVE_COMMENTS, NEUTRAL_COMMENTS, NEGATIVE_COMMENTS], weights=[5, 3, 2])[0]
        items.append({
            "text": rng.choice(bucket),
            "uid": persona.uid,
            "user": persona.name,
            "location": f"IP属地：{persona.location}",
            "user_level": persona.level,
            "user_sex": persona.gender,
            "vip_status": persona.vip_status,
            "vip_type": persona.vip_type,
            "official_verify_type": -1,
            "like": rng.randint(0, 200),
            "reply_count": rng.randint(0, 5),
            "up_liked": rng.random() < 0.05,
            "up_replied": False,
        })
    return items


def _gen_danmakus(rng: random.Random, count: int) -> list[str]:
    # Real get_danmakus() returns a flat list[str] (no demographic metadata) —
    # match that shape exactly.
    bucket_pools = [POSITIVE_DANMAKU, NEUTRAL_DANMAKU, NEGATIVE_DANMAKU]
    return [
        rng.choice(rng.choices(bucket_pools, weights=[5, 3, 2])[0])
        for _ in range(count)
    ]


async def _reset_demo_data(db) -> None:
    """Delete everything tied to the demo identity. Matches by uid/bvid
    pattern rather than walking Query -> QueryVideo -> Video, so this also
    cleans up correctly if only part of the demo data survives (e.g. the
    demo query was deleted from the UI but the user/video rows were not)."""
    queries = (await db.execute(select(Query).where(Query.uid == DEMO_UID))).scalars().all()
    for q in queries:
        await db.delete(q)  # cascades QueryVideo
    await db.flush()

    videos = (await db.execute(select(Video).where(Video.bvid.like("BVDEMO%")))).scalars().all()
    for video in videos:
        await db.delete(video)  # cascades VideoStats/VideoContent/VideoSentiment
    await db.flush()

    user = await db.get(User, DEMO_UID)
    if user:
        await db.delete(user)
    await db.commit()


async def seed(reset: bool) -> None:
    Path(settings.DATA_DIR).mkdir(parents=True, exist_ok=True)
    await init_db()
    async with async_session() as db:
        existing_user = await db.get(User, DEMO_UID)
        existing_query = (
            await db.execute(select(Query).where(Query.uid == DEMO_UID))
        ).scalars().first()

        if existing_user and existing_query and not reset:
            print(
                f"Demo data already present (query_id={existing_query.id}, "
                f"{existing_query.video_count} videos). Use --reset to regenerate."
            )
            return

        if existing_user or existing_query:
            print("Resetting existing (or partial) demo data...")
            await _reset_demo_data(db)

        rng = random.Random(RNG_SEED)
        analyzer = get_analyzer("snownlp")

        db.add(User(
            uid=DEMO_UID, name=DEMO_USER_NAME, avatar_url=DEMO_AVATAR,
            last_fetched_at=datetime.now(timezone.utc),
        ))

        video_count = rng.randint(38, 52)
        start_date = date(2025, 11, 15)
        end_date = date(2026, 8, 25)
        publish_dates = _gen_publish_dates(rng, video_count, start_date, end_date)

        titles = rng.sample(TITLES, k=min(video_count, len(TITLES)))
        while len(titles) < video_count:
            titles.append(rng.choice(TITLES))
        rng.shuffle(titles)

        query = Query(
            uid=DEMO_UID, user_name=DEMO_USER_NAME,
            start_date=start_date, end_date=end_date,
            status="done", progress=None, video_count=video_count,
            sentiment_status="done",
        )
        db.add(query)
        await db.flush()

        totals: dict[str, int] = defaultdict(int)

        for i, (published_at, title) in enumerate(zip(publish_dates, titles), start=1):
            bvid = f"BVDEMO{i:04d}"
            aid = 900_000_000 + i
            cid = 800_000_000 + i
            duration = _gen_duration(rng)
            tags = ",".join(rng.sample(TAG_POOL, k=rng.randint(2, 4)))

            views = _gen_views(rng)
            likes = int(views * rng.uniform(0.03, 0.12))
            coins = int(likes * rng.uniform(0.2, 0.6))
            favorites = int(likes * rng.uniform(0.15, 0.5))
            shares = int(likes * rng.uniform(0.02, 0.15))
            comment_count = rng.randint(20, 400)
            danmaku_count = rng.randint(10, 600)

            db.add(Video(
                bvid=bvid, aid=aid, cid=cid, uid=DEMO_UID,
                title=title,
                description=f"{title} —— 演示数据,仅用于本地效果展示,非真实投稿。",
                cover_url="https://i0.hdslb.com/bfs/archive/demo-cover.jpg",
                duration=duration, published_at=published_at, tags=tags,
            ))
            db.add(VideoStats(
                bvid=bvid, views=views, likes=likes, coins=coins,
                favorites=favorites, shares=shares,
                danmaku_count=danmaku_count, comment_count=comment_count,
            ))
            db.add(QueryVideo(query_id=query.id, bvid=bvid))

            comments = _gen_comments(rng, min(comment_count, rng.randint(15, 60)))
            danmakus = _gen_danmakus(rng, min(danmaku_count, rng.randint(20, 80)))
            has_subtitle = rng.random() < 0.7
            subtitle = (
                f"大家好,这期我们来聊聊{title}。先说结论,{rng.choice(SUBTITLE_VERDICTS)},具体怎么操作往下看。"
                if has_subtitle else ""
            )

            db.add(VideoContent(
                bvid=bvid,
                comments=json.dumps(comments, ensure_ascii=False),
                danmakus=json.dumps(danmakus, ensure_ascii=False),
                subtitle=subtitle,
                fetched_at=datetime.now(timezone.utc),
            ))

            # Run the real sentiment pipeline (same code path as
            # run_sentiment_analysis) so VideoSentiment rows are exactly what
            # a real fetch + analyze cycle would have produced.
            danmaku_details = _analyze_items(normalize_items(danmakus), "danmaku", analyzer)
            comment_details = _analyze_items(normalize_items(comments), "comment", analyzer)
            danmaku_agg = _compute_aggregates(danmaku_details)
            comment_agg = _compute_aggregates(comment_details)

            db.add(VideoSentiment(
                bvid=bvid, analyzer=analyzer.name,
                danmaku_avg_score=danmaku_agg["avg_score"],
                danmaku_positive_pct=danmaku_agg["positive_pct"],
                danmaku_neutral_pct=danmaku_agg["neutral_pct"],
                danmaku_negative_pct=danmaku_agg["negative_pct"],
                danmaku_count=danmaku_agg["count"],
                comment_avg_score=comment_agg["avg_score"],
                comment_positive_pct=comment_agg["positive_pct"],
                comment_neutral_pct=comment_agg["neutral_pct"],
                comment_negative_pct=comment_agg["negative_pct"],
                comment_count=comment_agg["count"],
                details=json.dumps(danmaku_details + comment_details, ensure_ascii=False),
                analyzed_at=datetime.now(timezone.utc),
            ))

            totals["views"] += views
            totals["likes"] += likes
            totals["coins"] += coins
            totals["favorites"] += favorites
            totals["shares"] += shares
            totals["danmaku"] += danmaku_count
            totals["comments"] += comment_count

        query.total_views = totals["views"]
        query.total_likes = totals["likes"]
        query.total_coins = totals["coins"]
        query.total_favorites = totals["favorites"]
        query.total_shares = totals["shares"]
        query.total_danmaku = totals["danmaku"]
        query.total_comments = totals["comments"]

        await db.commit()
        print(
            f"Seeded demo query id={query.id} with {video_count} videos "
            f"for uid={DEMO_UID} ({DEMO_USER_NAME})."
        )


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--reset", action="store_true", help="Delete existing demo data before reseeding")
    args = parser.parse_args()
    asyncio.run(seed(reset=args.reset))


if __name__ == "__main__":
    main()
