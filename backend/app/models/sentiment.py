from datetime import datetime
from sqlalchemy import Integer, Text, DateTime, Float, ForeignKey, func
from sqlalchemy.orm import Mapped, mapped_column
from app.core.database import Base


class VideoSentiment(Base):
    __tablename__ = "video_sentiment"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    bvid: Mapped[str] = mapped_column(Text, ForeignKey("videos.bvid"), nullable=False)
    analyzer: Mapped[str] = mapped_column(Text, nullable=False, default="snownlp")

    # Danmaku sentiment aggregates
    danmaku_avg_score: Mapped[float] = mapped_column(Float, default=0.0)
    danmaku_positive_pct: Mapped[float] = mapped_column(Float, default=0.0)
    danmaku_neutral_pct: Mapped[float] = mapped_column(Float, default=0.0)
    danmaku_negative_pct: Mapped[float] = mapped_column(Float, default=0.0)
    danmaku_count: Mapped[int] = mapped_column(Integer, default=0)

    # Comment sentiment aggregates
    comment_avg_score: Mapped[float] = mapped_column(Float, default=0.0)
    comment_positive_pct: Mapped[float] = mapped_column(Float, default=0.0)
    comment_neutral_pct: Mapped[float] = mapped_column(Float, default=0.0)
    comment_negative_pct: Mapped[float] = mapped_column(Float, default=0.0)
    comment_count: Mapped[int] = mapped_column(Integer, default=0)

    # Per-item details as JSON: list of {text, score, label, confidence, user, uid, location, ...}
    details: Mapped[str | None] = mapped_column(Text, nullable=True)

    analyzed_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
