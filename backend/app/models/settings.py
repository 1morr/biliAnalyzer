from sqlalchemy import Text, Boolean
from sqlalchemy.orm import Mapped, mapped_column
from app.core.database import Base


class AppSettings(Base):
    __tablename__ = "app_settings"

    key: Mapped[str] = mapped_column(Text, primary_key=True)
    value: Mapped[str] = mapped_column(Text, nullable=False, default="")
    is_sensitive: Mapped[bool] = mapped_column(Boolean, default=False)
