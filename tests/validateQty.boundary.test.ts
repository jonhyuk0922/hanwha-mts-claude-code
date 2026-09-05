import { describe, expect, it } from 'vitest';
import { validateQty } from '../src/lib/validateQty';

describe('validateQty — 주문가능수량 경계값', () => {
  it('잔여 수량과 같은 수량은 주문 가능하다 (전량 주문)', () => {
    expect(validateQty(100, 100)).toBe(true);
    expect(validateQty(1, 1)).toBe(true);
  });

  it('잔여 수량보다 1주 많으면 초과로 거절한다', () => {
    expect(validateQty(101, 100)).toBe(false);
    expect(validateQty(2, 1)).toBe(false);
  });
});
