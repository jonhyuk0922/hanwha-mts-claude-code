// 교육용 가상 모듈. 실제 증권사 시스템과 무관하다.
/**
 * 세션 관리. 로그인 전문 조립, 순번 채번, 세션 만료 판정.
 *
 * 실제 인증(인증서·암호화)은 이 레포에 없다. certToken 은 호출하는 쪽이 준 문자열을 그대로 싣는다.
 * 2018.02 최초. 2019.05 순번을 세션별로 분리. 2020.10 만료 여유 시간 조정.
 */
import type { PacketHeader } from '../packet/types';
import { assemblePacket, emptyHeader } from '../packet/header';
import { concatBytes, decodeLegacy, padRightBytes, rtrim } from '../common/bytes';
import {
  BRIDGE_VERSION,
  MAX_SEQ_NO,
  MEDIA_API,
  MEDIA_HTS,
  MEDIA_MTS,
  MEDIA_TABLET,
  MEDIA_WEB,
  MSG_LOGIN,
  MSG_LOGOUT,
  SESSION_TTL_MS,
} from '../common/constants';
import { BridgeError, bridgeLog, isErrorCode } from '../common/errors';

export type SessionState = 'NONE' | 'LOGGING_IN' | 'ACTIVE' | 'EXPIRED' | 'LOGGED_OUT';

export interface LoginInput {
  userId: string;
  /** 인증 토큰. 이 모듈은 내용을 보지 않는다 */
  certToken: string;
  mediaCd?: string;
  deviceId?: string;
  appVersion?: string;
}

/** 로그인 바디 배치 (고정 160 bytes) */
const LOGIN_LAYOUT: readonly (readonly [string, number])[] = [
  ['userId', 16],
  ['certToken', 88],
  ['mediaCd', 2],
  ['deviceId', 32],
  ['appVersion', 12],
  ['filler', 10],
];

export class SessionManager {
  private state: SessionState = 'NONE';
  private sessionId = '';
  private seq = 0;
  private loginAt = 0;
  private userId = '';
  private mediaCd = MEDIA_MTS;
  private listeners: ((s: SessionState) => void)[] = [];

  getState(): SessionState {
    return this.state;
  }

  getSessionId(): string {
    return this.sessionId;
  }

  getUserId(): string {
    return this.userId;
  }

  getMediaCd(): string {
    return this.mediaCd;
  }

  onStateChange(cb: (s: SessionState) => void): () => void {
    this.listeners.push(cb);
    return () => {
      this.listeners = this.listeners.filter((x) => x !== cb);
    };
  }

  private setState(next: SessionState): void {
    if (this.state === next) return;
    bridgeLog('I', 'SS', `${this.state} -> ${next}`);
    this.state = next;
    for (const cb of this.listeners.slice()) {
      try {
        cb(next);
      } catch (e) {
        // 화면 콜백 오류가 세션을 죽이지 않게. 삼키고 로그만
        bridgeLog('E', 'SS', `listener error ${String(e)}`);
      }
    }
  }

  /** 다음 순번. 99999999 다음은 1 */
  nextSeq(): number {
    this.seq = this.seq >= MAX_SEQ_NO ? 1 : this.seq + 1;
    return this.seq;
  }

  /** 요청 헤더에 세션 값을 채운다 */
  stamp(h: PacketHeader): PacketHeader {
    return { ...h, sessionId: this.sessionId, seqNo: h.seqNo || this.nextSeq() };
  }

  buildLoginPacket(input: LoginInput): Uint8Array {
    if (!input.userId) throw new BridgeError('E0001', 'userId 없음');
    if (this.state === 'ACTIVE') throw new BridgeError('E0003', this.userId);
    const media = normalizeMedia(input.mediaCd);
    const values: Record<string, string> = {
      userId: input.userId,
      certToken: input.certToken,
      mediaCd: media,
      deviceId: input.deviceId ?? '',
      appVersion: input.appVersion ?? BRIDGE_VERSION,
      filler: '',
    };
    const body = concatBytes(LOGIN_LAYOUT.map(([k, len]) => padRightBytes(values[k] ?? '', len)));
    this.userId = input.userId;
    this.mediaCd = media;
    this.seq = 0;
    this.setState('LOGGING_IN');
    const h = { ...emptyHeader(MSG_LOGIN), seqNo: this.nextSeq() };
    return assemblePacket(h, body);
  }

  /**
   * 로그인 응답 처리. 바디 앞 12바이트가 세션 ID, 다음 80바이트가 메시지.
   * errCode 가 있으면 실패.
   */
  handleLoginResponse(h: PacketHeader, body: Uint8Array): void {
    if (isErrorCode(h.errCode)) {
      const msg = rtrim(decodeLegacy(body, 12, Math.min(body.length, 92)));
      this.setState('NONE');
      throw new BridgeError(h.errCode.trim(), msg);
    }
    const sid = rtrim(decodeLegacy(body, 0, Math.min(body.length, 12)));
    if (!sid) {
      this.setState('NONE');
      throw new BridgeError('E0008', 'empty sessionId');
    }
    this.sessionId = sid;
    this.loginAt = Date.now();
    this.setState('ACTIVE');
  }

  buildLogoutPacket(): Uint8Array {
    const h = this.stamp(emptyHeader(MSG_LOGOUT));
    return assemblePacket(h, new Uint8Array(0));
  }

  /** 로그아웃 처리. 서버 응답을 기다리지 않는다 (2019.05 앱 종료 지연 민원) */
  logout(): void {
    this.sessionId = '';
    this.loginAt = 0;
    this.setState('LOGGED_OUT');
  }

  /** 서버가 세션 만료(E0002)를 주거나 TTL 이 지났을 때 */
  expire(): void {
    if (this.state !== 'ACTIVE') return;
    this.setState('EXPIRED');
  }

  isExpired(now = Date.now()): boolean {
    if (this.state !== 'ACTIVE') return this.state === 'EXPIRED';
    return now - this.loginAt > SESSION_TTL_MS;
  }

  /** 요청 보내기 전에 부른다. 만료면 예외 */
  assertActive(): void {
    if (this.isExpired()) {
      this.expire();
      throw new BridgeError('E0002', this.userId);
    }
    if (this.state !== 'ACTIVE') throw new BridgeError('E0009', this.state);
  }

  /** 테스트·재접속용. 세션 ID 는 유지하고 순번만 되돌린다 */
  resetSeq(): void {
    this.seq = 0;
  }
}

/** 매체 코드 보정. 알 수 없는 값은 MTS 로 */
export function normalizeMedia(cd: string | undefined): string {
  switch (cd) {
    case MEDIA_HTS:
    case MEDIA_MTS:
    case MEDIA_API:
    case MEDIA_WEB:
      return cd;
    case MEDIA_TABLET:
      // 2018 태블릿 앱 코드는 서버가 거부한다. MTS 로 바꿔서 보낸다
      return MEDIA_MTS;
    case undefined:
    case '':
      return MEDIA_MTS;
    default:
      bridgeLog('W', 'SS', `unknown mediaCd ${cd}, use MTS`);
      return MEDIA_MTS;
  }
}
