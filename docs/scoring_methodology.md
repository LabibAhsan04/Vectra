# Vectra Scoring Methodology

## Category definitions

| Category | What it measures |
|----------|------------------|
| **Momentum** (25%) | Near-term price change, price vs MA20, relative volume |
| **Technical** (25%) | Price vs MA50, MA20/MA50 alignment, RSI context |
| **Sentiment** (20%) | Tone of **company** headlines (heavy) and sector/market headlines (light) |
| **Fundamentals / Data Quality** (15%) | Availability and quality of reliable company fundamentals |
| **Growth / Catalysts** (15%) | Headline-level catalyst context only — not invented filings |

## Formula

```
Final Score = Momentum×0.25 + Technical×0.25 + Sentiment×0.20
            + Fundamentals×0.15 + Growth×0.15
```

When fundamentals are unavailable, the Fundamentals weight is redistributed across the other four categories so a missing filings pillar does not dominate. The Fundamentals category score is still shown (typically capped near 45) for transparency.

## Signal thresholds

| Score | Research label |
|------:|----------------|
| 80–100 | Strong Bullish |
| 65–79 | Bullish |
| 41–64 | Neutral |
| 21–40 | Bearish |
| 0–20 | Strong Bearish |

## Examples

### Bullish sketch
- Price above MA20/MA50, positive daily change, constructive company headlines
- Category scores might look like Momentum 70, Technical 68, Sentiment 62, Fundamentals 45, Growth 55
- Final score is the weighted sum (reproducible from the UI “Why this score?” panel)

### Neutral sketch
- Mixed MA structure, flat change, limited company news
- Category scores clustered near 45–55 → Neutral research signal

### Bearish sketch
- Price below MA20/MA50, negative change, cautious company tone
- Lower momentum/technical/sentiment → Bearish or Strong Bearish

## Data limitations

Free-tier market/news APIs can be delayed, incomplete, or rate-limited. Fundamental filings (revenue, margins, debt) are often unavailable — Vectra states this explicitly instead of inventing numbers.

## Why AI does not calculate the score

OpenRouter is an **explanation layer** only. The composite score and label are computed by the deterministic signal engine so results stay transparent, reproducible, and free of hallucinated fundamentals. If OpenRouter is unavailable, a template explanation is generated from the same structured evidence.
