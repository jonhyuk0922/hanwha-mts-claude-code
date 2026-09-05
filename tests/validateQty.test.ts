import { describe, expect, it } from 'vitest';
import { validateQty } from '../src/lib/validateQty';

describe('validateQty', () => {
  it('주문가능수량 안의 정수 수량은 통과한다', () => {
    expect(validateQty(1, 100)).toBe(true);
    expect(validateQty(50, 100)).toBe(true);
    expect(validateQty(99, 100)).toBe(true);
  });

  it('주문가능수량을 넘으면 거절한다', () => {
    expect(validateQty(101, 100)).toBe(false);
    expect(validateQty(1, 0)).toBe(false);
  });

  it('0 이하나 정수가 아닌 수량은 거절한다', () => {
    expect(validateQty(0, 100)).toBe(false);
    expect(validateQty(-5, 100)).toBe(false);
    expect(validateQty(1.5, 100)).toBe(false);
    expect(validateQty(Number.NaN, 100)).toBe(false);
  });

  it('주문가능수량이 유효하지 않으면 거절한다', () => {
    expect(validateQty(1, -1)).toBe(false);
    expect(validateQty(1, Number.NaN)).toBe(false);
    expect(validateQty(1, Number.POSITIVE_INFINITY)).toBe(false);
  });
});
