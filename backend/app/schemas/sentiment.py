from pydantic import BaseModel


class SentimentDistribution(BaseModel):
    avg_score: float
    positive_pct: float
    neutral_pct: float
    negative_pct: float
    count: int


class SentimentOverview(BaseModel):
    status: str | None
    danmaku: SentimentDistribution | None = None
    comment: SentimentDistribution | None = None


class SentimentTrendPoint(BaseModel):
    date: str
    danmaku_avg: float | None = None
    comment_avg: float | None = None
    danmaku_positive_pct: float | None = None
    comment_positive_pct: float | None = None


class SentimentWordItem(BaseModel):
    name: str
    value: int
    avg_score: float
    label: str


class DemographicSentimentCell(BaseModel):
    dimension: str
    category: str
    avg_score: float
    positive_pct: float
    neutral_pct: float
    negative_pct: float
    count: int
