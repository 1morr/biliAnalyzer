from pydantic import BaseModel


class StatsSummary(BaseModel):
    total_views: int
    total_likes: int
    total_coins: int
    total_favorites: int
    total_shares: int
    total_danmaku: int
    total_comments: int
    video_count: int


class TrendPoint(BaseModel):
    date: str
    views: int


class InteractionData(BaseModel):
    likes: int
    coins: int
    favorites: int
    shares: int


class VideoComparison(BaseModel):
    """For radar chart: this video's stats vs query average"""
    metrics: list[str]
    video_values: list[float]
    average_values: list[float]
    percentage_diff: list[float]
    max_values: list[float]  # Global max for each metric across all videos in query


class DistributionItem(BaseModel):
    name: str
    value: int


class UserRecord(BaseModel):
    gender: str
    vip: str
    level: str
    location: str | None = None


class UserDemographicsResponse(BaseModel):
    total_unique_users: int
    uid_backed_users: int
    username_fallback_users: int
    vip_ratio: list[DistributionItem]
    gender_ratio: list[DistributionItem]
    level_distribution: list[DistributionItem]
    location_distribution: list[DistributionItem]
    users: list[UserRecord] = []


class WordFrequencyItem(BaseModel):
    name: str
    value: int


class WordFrequencyResponse(BaseModel):
    words: list[WordFrequencyItem]


class SnippetItem(BaseModel):
    text: str
    user: str | None = None
    source: str | None = None  # "danmaku" | "comment" | None


class WordContextVideo(BaseModel):
    bvid: str
    title: str
    count: int
    snippets: list[SnippetItem]


class WordDetailResponse(BaseModel):
    word: str
    total_count: int
    videos: list[WordContextVideo]
