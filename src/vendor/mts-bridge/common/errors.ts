// 교육용 가상 모듈. 실제 증권사 시스템과 무관하다.
/**
 * 브리지 오류 타입과 로그 링버퍼.
 *
 * 로그는 콘솔로 내보내지 않는다. 2019 모바일 성능 이슈로 콘솔 출력을 다 걷어냈고,
 * 대신 링버퍼에 쌓아 두었다가 장애 신고 때 getBridgeLog() 로 떠서 보낸다.
 */
import { ERROR_CODES } from './errorCodes.generated';
import { LOG_RING_SIZE } from './constants';

export class BridgeError extends Error {
  /** 'E' + 4자리. errorCodes.generated.ts 참조 */
  readonly code: string;
  readonly detail: string;
  readonly trCode: string;

  constructor(code: string, detail = '', trCode = '') {
    super(`${code} ${describeError(code)}${detail ? ` (${detail})` : ''}`);
    this.name = 'BridgeError';
    this.code = code;
    this.detail = detail;
    this.trCode = trCode;
  }
}

/** 코드 → 문구. 표에 없으면 코드만 돌려준다 */
export function describeError(code: string): string {
  return ERROR_CODES[code] ?? `[미등록] ${code}`;
}

/** 헤더 errCode 가 오류인지. 공백 5자리 또는 '00000' 이면 정상 (구 서버는 '00000' 을 준다) */
export function isErrorCode(code: string): boolean {
  const c = code.trim();
  if (c === '' || c === '00000' || c === '0000') return false;
  return true;
}

/** 재시도해도 되는 오류인지. 서버팀 구두 합의 (2019.03) 기준이라 문서는 없다 */
export function isRetryable(code: string): boolean {
  switch (code) {
    case 'E9001': // 서버 점검 중
    case 'E9002': // 서버 과부하
    case 'E9003': // 시간 초과
    case 'E9005': // 거래소 연결 끊김
    case 'E9006': // 원장 지연
      return true;
    case 'E1009': // 순번 역전. 재시도하면 더 꼬인다
    case 'E0002': // 세션 만료. 재로그인이 먼저
    case 'E0003': // 중복 로그인
      return false;
    default:
      // 주문(30xx) 은 절대 자동 재시도하지 않는다. 중복 주문 사고 (2018.11)
      if (code.startsWith('E30')) return false;
      return false;
  }
}

export type LogLevel = 'D' | 'I' | 'W' | 'E';

const LEVEL_ORDER: Record<LogLevel, number> = { D: 0, I: 1, W: 2, E: 3 };

let minLevel: LogLevel = 'I';
const ring: string[] = [];
let ringHead = 0;
let ringFull = false;

export function setLogLevel(level: LogLevel): void {
  minLevel = level;
}

/** 링버퍼에 한 줄 남긴다. tag 는 모듈 이름 (QB, OG, SS 등 두 글자 관례) */
export function bridgeLog(level: LogLevel, tag: string, msg: string): void {
  if (LEVEL_ORDER[level] < LEVEL_ORDER[minLevel]) return;
  const line = `${stamp()} ${level} [${tag}] ${msg}`;
  if (ring.length < LOG_RING_SIZE) {
    ring.push(line);
  } else {
    ring[ringHead] = line;
    ringHead = (ringHead + 1) % LOG_RING_SIZE;
    ringFull = true;
  }
}

/** 쌓인 로그를 오래된 순서로 */
export function getBridgeLog(): string[] {
  if (!ringFull) return ring.slice();
  return ring.slice(ringHead).concat(ring.slice(0, ringHead));
}

export function clearBridgeLog(): void {
  ring.length = 0;
  ringHead = 0;
  ringFull = false;
}

function stamp(): string {
  const d = new Date();
  const p2 = (n: number) => String(n).padStart(2, '0');
  const p3 = (n: number) => String(n).padStart(3, '0');
  return `${p2(d.getHours())}:${p2(d.getMinutes())}:${p2(d.getSeconds())}.${p3(d.getMilliseconds())}`;
}
