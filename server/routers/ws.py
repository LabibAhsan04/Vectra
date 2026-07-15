"""WebSocket live quote stream (server-pushed refreshes)."""

from __future__ import annotations

import asyncio
import json

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from services.market_data import get_stock_quote

router = APIRouter(tags=["websocket"])


@router.websocket("/ws/quotes/{ticker}")
async def quote_stream(websocket: WebSocket, ticker: str) -> None:
    symbol = ticker.strip().upper()
    if not symbol:
        await websocket.close(code=1008)
        return
    await websocket.accept()
    try:
        while True:
            try:
                quote = get_stock_quote(symbol)
                await websocket.send_text(
                    json.dumps(
                        {
                            "ticker": quote.ticker,
                            "price": quote.price,
                            "change": quote.change,
                            "changePct": quote.changePct,
                            "timestamp": quote.timestamp.isoformat(),
                        }
                    )
                )
            except Exception as exc:
                await websocket.send_text(json.dumps({"error": str(exc)}))
            await asyncio.sleep(60)
    except WebSocketDisconnect:
        return
