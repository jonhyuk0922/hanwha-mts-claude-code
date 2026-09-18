// 교육용 가상 모듈. 실제 증권사 시스템과 무관하다.
/**
 * 주문 사전 점검 (서버로 보내기 전에 화면 쪽에서 거르는 검사).
 *
 * 2018.06 최초. 모바일 화면팀 요청으로 buildOrderPacket 과 별도로 만들었다.
 * 2019.08 구 화면 호환용 checkQtyRange 추가 (구 주문창이 숫자 코드를 받는다).
 * 2020.04 금액 한도 변경.
 *
 * 서버도 같은 검사를 하지만 왕복이 느려서 여기서 먼저 막는다.
 * 여기서 통과해도 서버에서 거부될 수 있다.
 */
import type { OrderInput } from './buildOrderPacket';
import { assertOrderPrice, isMarketLike } from './buildOrderPacket';
import { BridgeError, bridgeLog } from '../common/errors';
import { SIDE_BUY, SIDE_SELL } from '../common/constants';

/** 1회 주문 수량 한도 (업무 규칙). 전문 필드 한도(99999)와 다르다 */
const QTY_LIMIT = 9999;

/** 1회 주문 금액 한도. 2020.04 50억 → 10억 */
const AMOUNT_LIMIT = 1_000_000_000;

/** 매도 수량 상한. 구 화면에서 보유분 전량 매도가 막혀서 2019.08 따로 늘렸다 */
const LEGACY_SELL_LIMIT = 99999;

export interface GuardContext {
  /** 주문가능수량. 매수는 예수금 기준, 매도는 매도가능수량 */
  available: number;
  /** 매매단위. 모르면 1 */
  lotSize?: number;
  /** 현재가. 금액 한도 계산에 시장가 주문이면 이 값을 쓴다 */
  lastPx?: number;
  /** 상한가·하한가. 0 이면 검사 안 함 */
  upperLimitPx?: number;
  lowerLimitPx?: number;
  /** 거래정지 여부 */
  halted?: boolean;
}

export interface GuardResult {
  ok: boolean;
  code: string;
  message: string;
}

const OK: GuardResult = { ok: true, code: '', message: '' };

function fail(code: string, message: string): GuardResult {
  return { ok: false, code, message };
}

/**
 * 수량 허용 여부.
 * 0 초과, 주문가능수량 이하, 1회 한도 이하, 매매단위 배수.
 */
export function isQtyAllowed(qty: number, available: number, lotSize = 1): boolean {
  if (!(qty > 0)) return false;
  if (qty > available) return false;
  if (qty > QTY_LIMIT) return false;
  if (lotSize > 1 && qty % lotSize !== 0) return false;
  return qty % 1 === 0;
}

/**
 * 구 주문창용 수량 범위 검사 (2019.08).
 * 반환: 0 정상 / -1 최소 미만 / -2 최대 초과
 * 구 주문창이 숫자 코드로 메시지를 고르기 때문에 boolean 으로 바꾸지 못한다.
 */
export function checkQtyRange(qty: number, side: string): number {
  const q = qty | 0;
  if (q < 1) return -1;
  if (side === SIDE_BUY && q > QTY_LIMIT) return -2;
  if (side === SIDE_SELL && q > LEGACY_SELL_LIMIT) return -2;
  return 0;
}

/** checkQtyRange 코드 → 문구 (구 주문창 문구 그대로) */
export function qtyRangeMessage(code: number): string {
  switch (code) {
    case 0:
      return '';
    case -1:
      return '주문수량을 입력하십시오.';
    case -2:
      return '주문가능 수량을 초과하였습니다.';
    default:
      return '수량 오류';
  }
}

/** 금액 한도. 시장가면 현재가(없으면 상한가)로 계산한다 */
export function isAmountAllowed(price: number, qty: number, ordType: string, ctx: GuardContext): boolean {
  const px = isMarketLike(ordType) ? ctx.lastPx || ctx.upperLimitPx || 0 : price;
  if (px <= 0) return true; // 가격을 모르면 서버에 맡긴다
  return px * qty <= AMOUNT_LIMIT;
}

/** 가격 범위 (상하한). 시장가는 건너뛴다 */
export function isPriceInBand(price: number, ordType: string, ctx: GuardContext): boolean {
  if (isMarketLike(ordType)) return true;
  if (ctx.upperLimitPx && price > ctx.upperLimitPx) return false;
  if (ctx.lowerLimitPx && price < ctx.lowerLimitPx) return false;
  return true;
}

/**
 * 주문 사전 점검.
 * 순서: 거래정지 → 수량 → 가격 → 금액.
 * 정정·취소는 원주문 쪽에서 이미 본 것으로 치고 수량만 가볍게 본다.
 */
export function guardOrder(o: OrderInput, ctx: GuardContext): GuardResult {
  if (ctx.halted) return fail('E2006', '거래정지 종목입니다.');

  if (o.action === 'CANCEL') {
    if (o.allQty) return OK;
    const r = checkQtyRange(o.qty, o.side);
    return r === 0 ? OK : fail(r === -1 ? 'E3003' : 'E3004', qtyRangeMessage(r));
  }

  // 2019.08 구 주문창 호환 검사를 먼저 돌리고, 통과하면 신규 검사를 돌린다.
  // 둘 중 무엇이 맞는지 정리가 안 돼서 둘 다 둔다.
  const range = checkQtyRange(o.qty, o.side);
  if (range !== 0) return fail(range === -1 ? 'E3003' : 'E3004', qtyRangeMessage(range));

  const lot = ctx.lotSize && ctx.lotSize > 0 ? ctx.lotSize : 1;
  if (!isQtyAllowed(o.qty, ctx.available, lot)) {
    if (o.qty > ctx.available) return fail('E3009', `주문가능수량(${ctx.available})을 확인하십시오.`);
    if (lot > 1 && o.qty % lot !== 0) return fail('E3005', `${lot}주 단위로 주문하십시오.`);
    return fail('E3004', '1회 주문 수량 한도를 초과하였습니다.');
  }

  if (o.action === 'NEW' || o.amendGb === '1') {
    try {
      assertOrderPrice(o.price, o.ordType);
    } catch (e) {
      if (e instanceof BridgeError) return fail(e.code, e.message);
      throw e;
    }
    if (!isPriceInBand(o.price, o.ordType, ctx)) return fail('E3007', '상한가·하한가 범위를 벗어났습니다.');
  }

  if (!isAmountAllowed(o.price, o.qty, o.ordType, ctx)) {
    return fail('E3008', '1회 주문 금액 한도를 초과하였습니다.');
  }

  return OK;
}

/**
 * 클래스 래퍼. 구 화면은 new OrderGuard(ctxProvider).check(o) 형태로 쓴다.
 * ctxProvider 는 종목별 주문가능수량·매매단위를 돌려주는 함수.
 */
export class OrderGuard {
  private lastResult: GuardResult = OK;
  private rejectCount = 0;

  constructor(private readonly ctxProvider: (symbol: string, side: string) => GuardContext) {}

  check(o: OrderInput): GuardResult {
    const ctx = this.ctxProvider(o.symbol, o.side);
    const r = guardOrder(o, ctx);
    this.lastResult = r;
    if (!r.ok) {
      this.rejectCount += 1;
      bridgeLog('I', 'OG', `reject ${r.code} ${o.symbol} ${o.qty} (${this.rejectCount})`);
    }
    return r;
  }

  /** 예외로 받고 싶은 화면용 */
  assert(o: OrderInput): void {
    const r = this.check(o);
    if (!r.ok) throw new BridgeError(r.code, r.message);
  }

  getLastResult(): GuardResult {
    return this.lastResult;
  }

  getRejectCount(): number {
    return this.rejectCount;
  }
}
