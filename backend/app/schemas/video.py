from datetime import datetime
from pydantic import BaseModel


class VideoStatsSchema(BaseModel):
    views: int
    likes: int
    coins: int
    favorites: int
    shares: int
    danmaku_count: int
    comment_count: int
    interaction_rate: float  # computed: (likes+coins+favorites+shares)/views*100


class VideoSummary(BaseModel):
    bvid: str
    title: str
    cover_url: str | None
    duration: int
    published_at: datetime | None
    tags: str | None
    stats: VideoStatsSchema


class VideoDetail(VideoSummary):
    aid: int | None
    cid: int | None
    description: str | None
    has_danmaku: bool
    has_subtitle: bool


class PaginatedVideos(BaseModel):
    items: list[VideoSummary]
    total: int
    page: int
    page_size: int
    total_pages: int
