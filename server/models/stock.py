from datetime import datetime

from sqlalchemy import Column, DateTime, Float, Integer, JSON, String, Text
from sqlalchemy.orm import declarative_base

Base = declarative_base()


class StockAnalysis(Base):
    __tablename__ = "stock_analyses"

    id = Column(Integer, primary_key=True)
    ticker = Column(String(10), index=True)
    overall_score = Column(Integer)
    signal = Column(String(10))
    analysis_text = Column(Text)
    scores = Column(JSON)
    key_risks = Column(JSON)
    key_catalysts = Column(JSON)
    created_at = Column(DateTime, default=datetime.utcnow)


class WatchlistItem(Base):
    __tablename__ = "watchlist"

    id = Column(Integer, primary_key=True)
    ticker = Column(String(10), unique=True, index=True)
    added_at = Column(DateTime, default=datetime.utcnow)


class PriceCache(Base):
    __tablename__ = "price_cache"

    id = Column(Integer, primary_key=True)
    ticker = Column(String(10), index=True)
    price = Column(Float)
    change_pct = Column(Float)
    data_json = Column(JSON)
    fetched_at = Column(DateTime, default=datetime.utcnow)
