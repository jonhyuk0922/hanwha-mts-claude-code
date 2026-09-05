/** 1회 주문 금액 상한 (원) — 모의 계좌 기준 */
export const MAX_ORDER_AMOUNT = 100_000_000;

/** 1회 주문 수량 상한 (주) */
export const MAX_ORDER_QTY = 9_999;

/** 종목별 매매 단위 (주). 표시 없으면 1주 */
const LOT_SIZE: Record<string, number> = {
  '207940': 1,
  '373220': 1,
};

export function lotSizeOf(symbol: string): number {
  return LOT_SIZE[symbol] ?? 1;
}

/** 매매 단위의 배수인지 확인한다 */
export function checkLotSize(symbol: string, qty: number): boolean {
  const lot = lotSizeOf(symbol);
  return qty % lot === 0;
}

/** 주문 금액(가격 × 수량)이 상한 이내인지 확인한다 */
export function checkOrderAmount(price: number, qty: number): boolean {
  return price * qty <= MAX_ORDER_AMOUNT;
}

/** 주문 수량이 1회 상한 이내인지 확인한다 */
export function checkMaxQty(qty: number): boolean {
  return qty <= MAX_ORDER_QTY;
}
