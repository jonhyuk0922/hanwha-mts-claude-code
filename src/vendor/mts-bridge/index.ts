// 교육용 가상 모듈. 실제 증권사 시스템과 무관하다.
/**
 * mts-bridge 진입점.
 *
 * 신규 화면 코드에서 이 모듈을 import 하지 않는다. 레거시 유지보수 대상이다.
 * 앱의 시세는 src/hooks/useQuoteFeed.ts, 주문 검사는 src/lib 쪽을 쓴다.
 */
export { QuoteBridge, NullTransport } from './quote/QuoteBridge';
export type { BridgeState, PushCallback, RequestCallback, QuoteBridgeOptions } from './quote/QuoteBridge';

export { buildOrderPacket, buildCancelPacket, orderTrCode, ordTypeName } from './order/buildOrderPacket';
export type { OrderInput, BuiltOrder, OrderAction, OrderSideCode } from './order/buildOrderPacket';
export { OrderGuard, guardOrder } from './order/OrderGuard';
export type { GuardContext, GuardResult } from './order/OrderGuard';

export { SessionManager } from './session/SessionManager';
export type { SessionState, LoginInput } from './session/SessionManager';

export { getTrSpec, requireTrSpec, allTrCodes, describeTr, kindOfCode, timeoutFor } from './tr/trRegistry';
export { decodeBody, encodeInput, validateSpec } from './packet/fieldCodec';
export { parseHeader, encodeHeader, assemblePacket, splitPacket } from './packet/header';
export { BridgeError, describeError, getBridgeLog, setLogLevel } from './common/errors';
export { BRIDGE_VERSION } from './common/constants';

export type {
  BridgeTransport,
  DecodedBody,
  FieldTuple,
  FieldType,
  Packet,
  PacketHeader,
  RawTrSpec,
  TrKind,
  TrRecord,
  TrSpec,
} from './packet/types';
