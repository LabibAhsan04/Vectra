from datetime import datetime

from sqlalchemy import Column, DateTime, Integer, String
from sqlalchemy.orm import declarative_base

Base = declarative_base()


class WatchlistItem(Base):
    __tablename__ = "watchlist"

    id = Column(Integer, primary_key=True)
    ticker = Column(String(10), unique=True, index=True)
    added_at = Column(DateTime, default=datetime.utcnow)


class AppSetting(Base):
    __tablename__ = "app_settings"

    key = Column(String(64), primary_key=True)
    value = Column(String(255), nullable=False)
