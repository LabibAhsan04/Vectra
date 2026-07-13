from datetime import datetime

from sqlalchemy import Column, DateTime, Float, Integer, String, Text

from models.stock import Base


class SignalRecord(Base):
    """Persisted research signal snapshots for history / backtesting."""

    __tablename__ = "signals"

    id = Column(Integer, primary_key=True)
    ticker = Column(String(10), index=True, nullable=False)
    timestamp = Column(DateTime, default=datetime.utcnow, index=True)
    price = Column(Float, nullable=False, default=0.0)
    final_score = Column(Integer, nullable=False)
    final_label = Column(String(32), nullable=False)
    momentum_score = Column(Integer, nullable=False, default=50)
    technical_score = Column(Integer, nullable=False, default=50)
    sentiment_score = Column(Integer, nullable=False, default=50)
    fundamentals_score = Column(Integer, nullable=False, default=50)
    growth_score = Column(Integer, nullable=False, default=50)
    explanation = Column(Text, nullable=True)
    data_sources = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class NewsItemRecord(Base):
    __tablename__ = "news_items"

    id = Column(Integer, primary_key=True)
    ticker = Column(String(10), index=True, nullable=False)
    title = Column(String(512), nullable=False)
    source = Column(String(128), nullable=True)
    url = Column(String(1024), nullable=True)
    published_at = Column(DateTime, nullable=True)
    relevance_tag = Column(String(32), nullable=True)
    relevance_score = Column(Integer, nullable=False, default=50)
    sentiment_label = Column(String(16), nullable=True)
    sentiment_score = Column(Float, nullable=False, default=0.0)


class AlertRecord(Base):
    __tablename__ = "alerts"

    id = Column(Integer, primary_key=True)
    ticker = Column(String(10), index=True, nullable=False)
    timestamp = Column(DateTime, default=datetime.utcnow, index=True)
    alert_type = Column(String(64), nullable=False)
    message = Column(Text, nullable=False)
    old_value = Column(String(128), nullable=True)
    new_value = Column(String(128), nullable=True)
