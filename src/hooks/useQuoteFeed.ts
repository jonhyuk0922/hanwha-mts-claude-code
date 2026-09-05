import { useEffect, useRef, useState } from 'react';
import type { Level, Quote, QuoteTick } from '../types';
import { applyQuote } from '../lib/applyQuote';
import { tickSize } from '../lib/format';

export type QuoteMap = Record<string, Quote>;

const INTERVAL_MS = 700;

/**
 * 초기 스냅샷을 받아 주기적으로 가짜 tick 을 만들어 반영한다.
 * 서버가 없으므로 브라우저 안에서 시세를 흉내 낸다. live=false 면 멈춘다.
 */
export function useQuoteFeed(initial: Quote[], live: boolean): QuoteMap {
  const [quotes, setQuotes] = useState<QuoteMap>(() =>
    Object.fromEntries(initial.map((q) => [q.symbol, q])),
  );
  const symbols = useRef(initial.map((q) => q.symbol));

  useEffect(() => {
    if (!live) return;
    const id = window.setInterval(() => {
      setQuotes((prev) => {
        const list = symbols.current;
        const symbol = list[Math.floor(Math.random() * list.length)];
        const q = prev[symbol];
        if (!q) return prev;
        return { ...prev, [symbol]: applyQuote(q, makeTick(q)) };
      });
    }, INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [live]);

  return quotes;
}

/** 전일 종가 ±5% 안에서 한 호가씩 움직이는 tick 을 만든다 */
function makeTick(q: Quote): QuoteTick {
  const step = tickSize(q.price);
  const move = Math.round((Math.random() - 0.5) * 3);
  let price = q.price + move * step;
  if (price > q.prevClose * 1.05 || price < q.prevClose * 0.95) price = q.price;

  return {
    symbol: q.symbol,
    price,
    ts: Date.now(),
    asks: rebuildBook(q.asks, price, step, +1),
    bids: rebuildBook(q.bids, price, step, -1),
  };
}

/** 새 가격 기준으로 10단계를 다시 깔고 잔량은 ±10% 흔든다 */
function rebuildBook(levels: Level[], price: number, step: number, dir: 1 | -1): Level[] {
  return levels.map((lv, k) => {
    const offset = dir > 0 ? k + 1 : k;
    const qty = Math.max(10, Math.round(lv.qty * (0.9 + Math.random() * 0.2)));
    return { price: price + dir * step * offset, qty };
  });
}
