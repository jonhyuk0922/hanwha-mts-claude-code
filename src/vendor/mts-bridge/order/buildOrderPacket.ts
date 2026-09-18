// 교육용 가상 모듈. 실제 증권사 시스템과 무관하다.
/**
 * 주문 전문 조립.
 *
 * 매수 OR2001 / 매도 OR2002 / 정정 OR2003 / 취소 OR2004.
 * 입력 블록 배치는 tr/trSpec.order.generated.ts 의 해당 TR 을 따른다.
 *
 * 이력
 *   2018.05 HTS 주문 모듈에서 이식. 검사 로직도 같이 가져왔다
 *   2018.11 중복 주문 사고 뒤 clientOrderKey 추가
 *   2019.03 시간외 호가 유형 추가
 *   2020.06 모바일 매체코드 분리
 *
 * 주의: 전송은 여기서 하지 않는다. 만든 바이트를 QuoteBridge 쪽 전송 계층에 넘긴다.
 */
import type { PacketHeader, TrRecord } from '../packet/types';
import { assemblePacket, emptyHeader } from '../packet/header';
import { encodeInput, findField } from '../packet/fieldCodec';
import { requireTrSpec } from '../tr/trRegistry';
import { BridgeError, bridgeLog } from '../common/errors';
import {
  AMEND_PRICE,
  AMEND_QTY,
  COND_FOK,
  COND_IOC,
  COND_NONE,
  MAX_ORD_PX,
  MAX_ORD_QTY,
  MSG_REQUEST,
  ORD_TYPE_AFTER_CLOSE,
  ORD_TYPE_AFTER_SINGLE,
  ORD_TYPE_BEST,
  ORD_TYPE_COND_LIMIT,
  ORD_TYPE_FIRST,
  ORD_TYPE_LIMIT,
  ORD_TYPE_MARKET,
  ORD_TYPE_PRE_CLOSE,
  PWD_ENC_LEN,
  SIDE_BUY,
  SIDE_SELL,
} from '../common/constants';
import type { SessionManager } from '../session/SessionManager';

export type OrderSideCode = typeof SIDE_BUY | typeof SIDE_SELL;
export type OrderAction = 'NEW' | 'AMEND' | 'CANCEL';

export interface OrderInput {
  action: OrderAction;
  acctNo: string;
  /** 암호화된 비밀번호 (44자). 이 모듈은 암호화하지 않는다 */
  pwdEnc: string;
  symbol: string;
  side: OrderSideCode;
  ordType: string;
  price: number;
  qty: number;
  condType?: string;
  /** 정정·취소일 때 원주문번호 */
  origOrdNo?: number;
  /** 정정 구분. 1 가격 / 2 수량 */
  amendGb?: string;
  /** 정정·취소 전량 여부 */
  allQty?: boolean;
  clientIp?: string;
}

export interface BuiltOrder {
  trCode: string;
  seqNo: number;
  bytes: Uint8Array;
  /** 중복 주문 방지 키. 같은 키로 3초 안에 다시 오면 막는다 */
  clientOrderKey: string;
}

/**
 * 주문수량 검사 (전문 조립 직전).
 *
 * 2018.05 HTS 코드에서 그대로 옮김. 필드가 N(5) 라서 99999 까지만 넣을 수 있다.
 * 1회 주문 한도는 업무 규칙이라 여기서 안 본다고 했는데, 어디서 보는지는 확인 못 했음.
 * 매매단위도 여기서 안 본다 (OrderGuard 쪽에서 본다고 들음).
 */
export function assertOrderQty(qty: number): void {
  if (typeof qty !== 'number' || isNaN(qty)) {
    throw new BridgeError('E3002', `qty=${String(qty)}`);
  }
  if (Math.floor(qty) !== qty) {
    throw new BridgeError('E3002', `소수 수량 ${qty}`);
  }
  if (qty <= 0) {
    throw new BridgeError('E3003', `qty=${qty}`);
  }
  if (qty > MAX_ORD_QTY) {
    throw new BridgeError('E3004', `qty=${qty} > ${MAX_ORD_QTY}`);
  }
}

/** 주문가격 검사. 시장가류는 0 이어야 한다 */
export function assertOrderPrice(price: number, ordType: string): void {
  if (isMarketLike(ordType)) {
    if (price !== 0) throw new BridgeError('E3006', `시장가인데 가격 ${price}`);
    return;
  }
  if (!Number.isFinite(price) || price <= 0) throw new BridgeError('E3006', `price=${price}`);
  if (Math.floor(price) !== price) throw new BridgeError('E3006', `소수 가격 ${price}`);
  if (price > MAX_ORD_PX) throw new BridgeError('E3007', `price=${price}`);
  const tick = legacyTickSize(price);
  if (price % tick !== 0) throw new BridgeError('E3006', `호가단위 ${tick} (price=${price})`);
}

/**
 * 호가단위 (2018 규정 기준 표).
 * 2023 개편 표와 다르다. 앱 쪽 lib/format.ts 의 tickSize 와 맞춰야 하는데 아직 안 맞췄다.
 */
export function legacyTickSize(price: number): number {
  if (price < 1000) return 1;
  if (price < 5000) return 5;
  if (price < 10000) return 10;
  if (price < 50000) return 50;
  if (price < 100000) return 100;
  if (price < 500000) return 500;
  return 1000;
}

/** 시장가 계열 호가 유형인지 (가격 0 으로 보낸다) */
export function isMarketLike(ordType: string): boolean {
  switch (ordType) {
    case ORD_TYPE_MARKET:
    case ORD_TYPE_BEST:
    case ORD_TYPE_FIRST:
    case ORD_TYPE_PRE_CLOSE:
    case ORD_TYPE_AFTER_CLOSE:
      return true;
    case ORD_TYPE_LIMIT:
    case ORD_TYPE_COND_LIMIT:
    case ORD_TYPE_AFTER_SINGLE:
      return false;
    default:
      // 모르는 유형은 지정가로 본다 (2019.03)
      return false;
  }
}

export function ordTypeName(ordType: string): string {
  switch (ordType) {
    case ORD_TYPE_LIMIT:
      return '지정가';
    case ORD_TYPE_MARKET:
      return '시장가';
    case ORD_TYPE_COND_LIMIT:
      return '조건부지정가';
    case ORD_TYPE_BEST:
      return '최유리지정가';
    case ORD_TYPE_FIRST:
      return '최우선지정가';
    case ORD_TYPE_PRE_CLOSE:
      return '장전시간외';
    case ORD_TYPE_AFTER_CLOSE:
      return '장후시간외';
    case ORD_TYPE_AFTER_SINGLE:
      return '시간외단일가';
    default:
      return `기타(${ordType})`;
  }
}

function condName(cond: string): string {
  switch (cond) {
    case COND_NONE:
      return '없음';
    case COND_IOC:
      return 'IOC';
    case COND_FOK:
      return 'FOK';
    default:
      return cond;
  }
}

/** 동작·매매구분으로 TR 코드 고르기 */
export function orderTrCode(action: OrderAction, side: OrderSideCode): string {
  switch (action) {
    case 'NEW':
      return side === SIDE_BUY ? 'OR2001' : 'OR2002';
    case 'AMEND':
      return 'OR2003';
    case 'CANCEL':
      return 'OR2004';
    default:
      throw new BridgeError('E1004', `action=${String(action)}`);
  }
}

/** 최근 주문 키 (중복 방지). 3초 지나면 지운다 */
const recentKeys = new Map<string, number>();
const DUP_WINDOW_MS = 3000;

function makeClientOrderKey(o: OrderInput): string {
  return [o.action, o.acctNo, o.symbol, o.side, o.ordType, o.price, o.qty, o.origOrdNo ?? ''].join(':');
}

function checkDuplicate(key: string, now: number): void {
  for (const [k, t] of recentKeys) {
    if (now - t > DUP_WINDOW_MS) recentKeys.delete(k);
  }
  if (recentKeys.has(key)) throw new BridgeError('E3015', key);
  recentKeys.set(key, now);
}

/** 테스트에서 중복 방지 기록을 비운다 */
export function resetDuplicateGuard(): void {
  recentKeys.clear();
}

/**
 * 주문 입력을 검사하고 전문 바이트로 만든다.
 * 검사 순서는 HTS 와 같게 둔다 (계좌 → 종목 → 수량 → 가격). 순서가 바뀌면 오류 문구가 달라져서 민원이 온다.
 */
export function buildOrderPacket(o: OrderInput, session: SessionManager, now = Date.now()): BuiltOrder {
  session.assertActive();

  if (!/^\d{11}$/.test(o.acctNo)) throw new BridgeError('E4001', o.acctNo);
  if (o.pwdEnc.length !== PWD_ENC_LEN) throw new BridgeError('E4002', `len=${o.pwdEnc.length}`);
  if (!o.symbol.trim()) throw new BridgeError('E2001', 'symbol 없음');

  const trCode = orderTrCode(o.action, o.side);
  const spec = requireTrSpec(trCode);

  const rec: TrRecord = {
    acctNo: o.acctNo,
    pwdEnc: o.pwdEnc,
    symbol: o.symbol,
    ordSide: o.side,
    ordType: o.ordType,
    ordPx: 0,
    ordQty: 0,
    condType: o.condType ?? COND_NONE,
    mediaCd: session.getMediaCd(),
    clientIp: o.clientIp ?? '',
  };

  switch (o.action) {
    case 'NEW': {
      assertOrderQty(o.qty);
      assertOrderPrice(o.price, o.ordType);
      rec.ordPx = o.price;
      rec.ordQty = o.qty;
      if (o.condType === COND_FOK && isMarketLike(o.ordType)) {
        // 시장가 FOK 는 거래소가 받지만 사내 규정상 막는다 (2019.03)
        throw new BridgeError('E3001', `${ordTypeName(o.ordType)} ${condName(o.condType)}`);
      }
      break;
    }
    case 'AMEND': {
      if (!o.origOrdNo) throw new BridgeError('E3010', 'origOrdNo 없음');
      rec.origOrdNo = o.origOrdNo;
      rec.amendGb = o.amendGb ?? AMEND_PRICE;
      rec.allQtyYn = o.allQty ? 'Y' : 'N';
      if (rec.amendGb === AMEND_QTY || !o.allQty) {
        assertOrderQty(o.qty);
        rec.ordQty = o.qty;
      }
      if (rec.amendGb === AMEND_PRICE) {
        assertOrderPrice(o.price, o.ordType);
        rec.ordPx = o.price;
      }
      break;
    }
    case 'CANCEL': {
      if (!o.origOrdNo) throw new BridgeError('E3010', 'origOrdNo 없음');
      rec.origOrdNo = o.origOrdNo;
      rec.allQtyYn = o.allQty ? 'Y' : 'N';
      // 전량 취소면 수량 0 으로 보낸다. 일부 취소만 수량 검사
      if (!o.allQty) {
        assertOrderQty(o.qty);
        rec.ordQty = o.qty;
      }
      break;
    }
    default:
      throw new BridgeError('E1004', `action=${String(o.action)}`);
  }

  // 스펙에 없는 필드는 encodeInput 이 알아서 버린다. 필수 필드가 스펙에 있는지만 확인
  const input = spec.input;
  if (!input || !findField(input, 'ordQty')) {
    throw new BridgeError('E1006', `${trCode} ordQty 필드 없음`, trCode);
  }

  const clientOrderKey = makeClientOrderKey(o);
  checkDuplicate(clientOrderKey, now);

  const body = encodeInput(spec, rec);
  const header: PacketHeader = session.stamp(emptyHeader(MSG_REQUEST, trCode));
  bridgeLog('I', 'OB', `${trCode} ${o.action} ${o.symbol} ${o.side === SIDE_BUY ? 'B' : 'S'} ${o.qty}@${o.price} seq=${header.seqNo}`);
  return { trCode, seqNo: header.seqNo, bytes: assemblePacket(header, body), clientOrderKey };
}

/** 취소 전용 줄임 함수. 화면에서 자주 써서 따로 뺐다 (2019.08) */
export function buildCancelPacket(
  session: SessionManager,
  acctNo: string,
  pwdEnc: string,
  symbol: string,
  origOrdNo: number,
  qty = 0,
): BuiltOrder {
  return buildOrderPacket(
    {
      action: 'CANCEL',
      acctNo,
      pwdEnc,
      symbol,
      side: SIDE_SELL,
      ordType: ORD_TYPE_LIMIT,
      price: 0,
      qty,
      origOrdNo,
      allQty: qty === 0,
    },
    session,
  );
}
