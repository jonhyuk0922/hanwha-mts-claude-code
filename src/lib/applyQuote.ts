import type { Quote, QuoteTick } from '../types';

/**
 * 시세 증분(tick)을 기존 스냅샷에 반영한 새 스냅샷을 돌려준다.
 * - 다른 종목의 tick 은 무시한다.
 * - 호가(asks/bids)가 없는 tick 은 가격만 갱신하고 호가는 유지한다.
 * - 입력 객체는 변경하지 않는다.
 */
export function applyQuote(prev: Quote, incoming: QuoteTick): Quote {
  if (incoming.symbol !== prev.symbol) return prev;

  const change = incoming.price - prev.prevClose;
  const changeRate = prev.prevClose === 0 ? 0 : round2((change / prev.prevClose) * 100);

  return {
    ...prev,
    price: incoming.price,
    change,
    changeRate,
    ts: incoming.ts,
    asks: incoming.asks ?? prev.asks,
    bids: incoming.bids ?? prev.bids,
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
