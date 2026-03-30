from datetime import datetime
from sqlalchemy import Integer, Text, DateTime, ForeignKey, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base


class Video(Base):
    __tablename__ = "videos"

    bvid: Mapped[str] = mapped_column(Text, primary_key=True)
    aid: Mapped[int | None] = mapped_column(Integer, nullable=True)
    cid: Mapped[int | None] = mapped_column(Integer, nullable=True)
    uid: Mapped[int] = mapped_column(Integer, ForeignKey("users.uid"), nullable=False)
    title: Mapped[str] = mapped_column(Text, nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    cover_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    duration: Mapped[int] = mapped_column(Integer, default=0)
    published_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    tags: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())

    stats: Mapped[list["VideoStats"]] = relationship(back_populates="video", cascade="all, delete-orphan")
    content: Mapped[list["VideoContent"]] = relationship(back_populates="video", cascade="all, delete-orphan")


class VideoStats(Base):
    __tablename__ = "video_stats"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    bvid: Mapped[str] = mapped_column(Text, ForeignKey("videos.bvid"), nullable=False)
    views: Mapped[int] = mapped_column(Integer, default=0)
    likes: Mapped[int] = mapped_column(Integer, default=0)
    coins: Mapped[int] = mapped_column(Integer, default=0)
    favorites: Mapped[int] = mapped_column(Integer, default=0)
    shares: Mapped[int] = mapped_column(Integer, default=0)
    danmaku_count: Mapped[int] = mapped_column(Integer, default=0)
    comment_count: Mapped[int] = mapped_column(Integer, default=0)
    fetched_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    video: Mapped["Video"] = relationship(back_populates="stats")


class VideoContent(Base):
    __tablename__ = "video_content"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    bvid: Mapped[str] = mapped_column(Text, ForeignKey("videos.bvid"), nullable=False)
    danmakus: Mapped[str | None] = mapped_column(Text, nullable=True)  # JSON array
    comments: Mapped[str | None] = mapped_column(Text, nullable=True)  # JSON array
    subtitle: Mapped[str | None] = mapped_column(Text, nullable=True)
    fetched_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    video: Mapped["Video"] = relationship(back_populates="content")
