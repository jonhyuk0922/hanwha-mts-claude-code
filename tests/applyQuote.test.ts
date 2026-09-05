import { describe, expect, it } from 'vitest';
import { applyQuote } from '../src/lib/applyQuote';
import type { Quote, QuoteTick } from '../src/types';

const base: Quote = {
  symbol: '005930',
  name: '삼성전자',
  price: 71300,
  prevClose: 70800,
  change: 500,
  changeRate: 0.71,
  ts: 1000,
  asks: [{ price: 71400, qty: 320 }],
  bids: [{ price: 71300, qty: 1240 }],
};

describe('applyQuote', () => {
  it('새 tick 의 가격으로 갱신하고 전일 대비를 다시 계산한다', () => {
    const tick: QuoteTick = { symbol: '005930', price: 71500, ts: 2000 };
    const next = applyQuote(base, tick);
    expect(next.price).toBe(71500);
    expect(next.change).toBe(700);
    expect(next.changeRate).toBe(0.99);
    expect(next.ts).toBe(2000);
  });

  it('호가가 없는 tick 은 기존 호가를 유지한다', () => {
    const next = applyQuote(base, { symbol: '005930', price: 71200, ts: 2000 });
    expect(next.asks).toEqual(base.asks);
    expect(next.bids).toEqual(base.bids);
  });

  it('호가가 있는 tick 은 호가를 교체한다', () => {
    const asks = [{ price: 71300, qty: 10 }];
    const bids = [{ price: 71200, qty: 20 }];
    const next = applyQuote(base, { symbol: '005930', price: 71200, ts: 2000, asks, bids });
    expect(next.asks).toBe(asks);
    expect(next.bids).toBe(bids);
  });

  it('다른 종목의 tick 은 무시한다', () => {
    const next = applyQuote(base, { symbol: '000660', price: 1, ts: 2000 });
    expect(next).toBe(base);
  });

  it('입력 객체를 변경하지 않는다', () => {
    const snapshot = structuredClone(base);
    applyQuote(base, { symbol: '005930', price: 70000, ts: 2000 });
    expect(base).toEqual(snapshot);
  });
});
