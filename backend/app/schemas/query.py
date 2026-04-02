from datetime import date, datetime
from pydantic import BaseModel


class FetchRequest(BaseModel):
    uid: int
    start_date: date
    end_date: date


class FetchResponse(BaseModel):
    query_id: int
    status: str


class QuerySummary(BaseModel):
    id: int
    uid: int
    user_name: str | None
    start_date: date
    end_date: date
    status: str
    progress: str | None
    video_count: int
    total_views: int
    created_at: datetime


class QueryDetail(QuerySummary):
    error_message: str | None
    total_likes: int
    total_coins: int
    total_favorites: int
    total_shares: int
    total_danmaku: int
    total_comments: int
    sentiment_status: str | None = None
