from datetime import datetime
from sqlalchemy import Integer, Text, DateTime
from sqlalchemy.orm import Mapped, mapped_column
from app.core.database import Base


class User(Base):
    __tablename__ = "users"

    uid: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(Text, nullable=False)
    avatar_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    last_fetched_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
