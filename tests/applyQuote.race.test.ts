import { describe, expect, it } from 'vitest';
import { applyQuote } from '../src/lib/applyQuote';
import type { Quote } from '../src/types';

/** 시각 3000 에 71,300 원으로 갱신된 최신 스냅샷 */
const latest: Quote = {
  symbol: '005930',
  name: '삼성전자',
  price: 71300,
  prevClose: 70800,
  change: 500,
  changeRate: 0.71,
  ts: 3000,
  asks: [{ price: 71400, qty: 320 }],
  bids: [{ price: 71300, qty: 1240 }],
};

describe('applyQuote — 호가 갱신 역순 도착', () => {
  it('타임스탬프가 더 이른 tick 이 늦게 도착하면 최신 호가를 덮어쓰지 않는다', () => {
    // 서버에서는 2000(71,250) → 3000(71,300) 순으로 났지만, 네트워크에서 순서가 뒤집혀
    // 3000 이 먼저 반영된 뒤 2000 이 늦게 도착했다.
    const next = applyQuote(latest, { symbol: '005930', price: 71250, ts: 2000 });
    expect(next.price).toBe(71300);
    expect(next.ts).toBe(3000);
  });

  it('무시한 tick 은 호가(asks/bids)도 건드리지 않는다', () => {
    const stale = {
      symbol: '005930',
      price: 71250,
      ts: 2000,
      asks: [{ price: 71300, qty: 1 }],
      bids: [{ price: 71200, qty: 1 }],
    };
    const next = applyQuote(latest, stale);
    expect(next.asks).toEqual(latest.asks);
    expect(next.bids).toEqual(latest.bids);
  });

  it('같은 타임스탬프의 tick 은 반영한다 (정정 데이터)', () => {
    const next = applyQuote(latest, { symbol: '005930', price: 71200, ts: 3000 });
    expect(next.price).toBe(71200);
  });
});
