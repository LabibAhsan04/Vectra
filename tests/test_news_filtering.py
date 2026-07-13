"""Unit tests for news relevance classification."""

from services.news_service import classify_news_relevance


def test_direct_company_news_nvda():
    relevance, section, score = classify_news_relevance(
        "Nvidia unveils next-generation GPU roadmap",
        "NVDA",
        company_name="NVIDIA Corporation",
    )
    assert relevance == "company"
    assert section == "company"
    assert score >= 80


def test_competitor_news():
    relevance, section, score = classify_news_relevance(
        "AMD challenges rivals with new AI accelerator",
        "NVDA",
        company_name="NVIDIA Corporation",
    )
    assert relevance == "competitor"
    assert section == "market"
    assert score < 80


def test_broad_market_news():
    relevance, section, score = classify_news_relevance(
        "S&P 500 and Dow Jones climb as investors cheer Fed comments",
        "NVDA",
        company_name="NVIDIA Corporation",
    )
    assert relevance == "market"
    assert section == "market"


def test_etf_news():
    relevance, section, _score = classify_news_relevance(
        "Tech ETF QQQ leads weekly inflows",
        "NVDA",
    )
    assert relevance == "etf"
    assert section == "market"


def test_unrelated_defaults_to_company_for_company_feed():
    relevance, section, score = classify_news_relevance(
        "Regional bank loan books stabilize quietly",
        "NVDA",
        company_name="NVIDIA Corporation",
    )
    # Finnhub company feed default when no rival/market cues.
    assert section == "company"
    assert relevance == "company"
    assert score == 70
