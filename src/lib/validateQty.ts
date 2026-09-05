/**
 * 주문 수량이 주문 가능한지 판정한다.
 * - 1주 이상의 정수여야 한다.
 * - 주문가능수량(available)을 초과하면 안 된다.
 * @returns 주문 가능하면 true
 */
export function validateQty(qty: number, available: number): boolean {
  if (!Number.isInteger(qty)) return false;
  if (qty < 1) return false;
  if (!Number.isFinite(available) || available < 0) return false;
  if (qty >= available) return false;
  return true;
}
