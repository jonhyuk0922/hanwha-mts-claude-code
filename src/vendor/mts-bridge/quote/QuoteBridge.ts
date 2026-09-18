// 교육용 가상 모듈. 실제 증권사 시스템과 무관하다.
/**
 * 시세 브리지 (콜백 방식 레거시 클래스).
 *
 * - 실시간 등록(subscribe) / 해지(unsubscribe)
 * - 조회 요청(request) 과 응답 매칭 (seqNo 기준)
 * - 끊기면 재연결하고, 재연결되면 등록해 둔 실시간을 다시 건다
 * - 하트비트
 *
 * 전송 계층(BridgeTransport)은 밖에서 넣는다. 이 레포에는 실제 소켓 구현이 없다.
 * NullTransport 는 아무 데도 안 보내는 더미다.
 *
 * 이력
 *   2018.03 최초 (HTS 코드에서 이식)
 *   2018.11 재연결 백오프 추가
 *   2019.07 조각 전문 처리 (모바일 망)
 *   2019.11 실시간 등록 40개 제한 대응
 *   2020.01 PUSH 폭주 시 배치 처리
 *   2021.03 Promise 버전 만들려다 중단. 콜백 그대로 둔다
 */
import type { BridgeTransport, DecodedBody, Packet, PacketHeader, TrRecord, TrSpec } from '../packet/types';
import { assemblePacket, describeHeader, emptyHeader, splitPacket } from '../packet/header';
import { decodeBody, encodeInput } from '../packet/fieldCodec';
import { getTrSpec, requireTrSpec, timeoutFor } from '../tr/trRegistry';
import { concatBytes, hexDump, padRightBytes } from '../common/bytes';
import { BridgeError, bridgeLog, isErrorCode, isRetryable } from '../common/errors';
import {
  FRAGMENT_WAIT_MS,
  MAX_CONT_QUERY,
  MAX_SUBSCRIPTIONS,
  MSG_ERROR,
  MSG_HEARTBEAT,
  MSG_LOGIN,
  MSG_LOGOUT,
  MSG_PUSH,
  MSG_PUSH_REG,
  MSG_PUSH_UNREG,
  MSG_REQUEST,
  MSG_RESPONSE,
  PUSH_BATCH_LIMIT,
  RECONNECT_BACKOFF_MS,
  RECONNECT_MAX_TRY,
} from '../common/constants';
import { createHeartbeat, type Heartbeat } from '../session/heartbeat';
import { SessionManager } from '../session/SessionManager';

export type BridgeState = 'IDLE' | 'CONNECTING' | 'READY' | 'RECONNECTING' | 'CLOSED';

/** 실시간 콜백. rec 는 출력 블록, rows 는 반복 블록 (호가 10단계 등) */
export type PushCallback = (trCode: string, key: string, rec: TrRecord, rows: TrRecord[]) => void;

/** 조회 콜백. err 가 있으면 body 는 null */
export type RequestCallback = (err: BridgeError | null, body: DecodedBody | null, header: PacketHeader | null) => void;

export interface QuoteBridgeOptions {
  transport: BridgeTransport;
  session?: SessionManager;
  onStateChange?: (s: BridgeState) => void;
  onError?: (e: BridgeError) => void;
  /** 로그인 전문을 만들어 달라는 요청. 재연결 때도 부른다 */
  loginProvider?: () => Uint8Array | null;
  heartbeatMs?: number;
}

interface Subscription {
  id: number;
  trCode: string;
  key: string;
  cb: PushCallback;
  /** 서버에 등록 전문을 보냈는지. 재연결 뒤 다시 false 로 */
  sent: boolean;
}

interface Pending {
  seqNo: number;
  trCode: string;
  cb: RequestCallback;
  timer: ReturnType<typeof setTimeout>;
  sentAt: number;
}

let nextSubId = 1;

export class QuoteBridge {
  private readonly transport: BridgeTransport;
  private readonly session: SessionManager;
  private readonly opts: QuoteBridgeOptions;
  private state: BridgeState = 'IDLE';
  private subs = new Map<number, Subscription>();
  private pending = new Map<number, Pending>();
  private recvBuf: Uint8Array = new Uint8Array(0);
  private fragTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectTry = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private heartbeat: Heartbeat;
  private pushQueue: Packet[] = [];
  private pushFlushScheduled = false;
  private closedByUser = false;
  /** 디버그 화면용 카운터 */
  readonly stats = { sent: 0, recv: 0, push: 0, dropped: 0, timeouts: 0, reconnects: 0 };

  constructor(opts: QuoteBridgeOptions) {
    this.opts = opts;
    this.transport = opts.transport;
    this.session = opts.session ?? new SessionManager();
    this.heartbeat = createHeartbeat(
      () => this.sendHeartbeat(),
      (missed) => this.handleDisconnect(`heartbeat missed ${missed}`),
      opts.heartbeatMs,
    );
    this.transport.onOpen = () => this.handleOpen();
    this.transport.onReceive = (bytes) => this.handleReceive(bytes);
    this.transport.onClose = (reason) => this.handleDisconnect(reason);
  }

  getState(): BridgeState {
    return this.state;
  }

  getSession(): SessionManager {
    return this.session;
  }

  private setState(next: BridgeState): void {
    if (this.state === next) return;
    bridgeLog('I', 'QB', `state ${this.state} -> ${next}`);
    this.state = next;
    if (this.opts.onStateChange) {
      try {
        this.opts.onStateChange(next);
      } catch (e) {
        bridgeLog('E', 'QB', `onStateChange threw ${String(e)}`);
      }
    }
  }

  private emitError(e: BridgeError): void {
    bridgeLog('E', 'QB', e.message);
    if (this.opts.onError) {
      try {
        this.opts.onError(e);
      } catch (inner) {
        bridgeLog('E', 'QB', `onError threw ${String(inner)}`);
      }
    }
  }

  // ------------------------------------------------------------------ 연결

  connect(): void {
    if (this.state === 'READY' || this.state === 'CONNECTING') return;
    this.closedByUser = false;
    this.setState('CONNECTING');
    this.transport.open();
  }

  disconnect(): void {
    this.closedByUser = true;
    this.heartbeat.stop();
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.state === 'READY') {
      try {
        this.transport.send(this.session.buildLogoutPacket());
      } catch (e) {
        bridgeLog('W', 'QB', `logout send failed ${String(e)}`);
      }
    }
    this.session.logout();
    this.failAllPending(new BridgeError('E0009', 'disconnect'));
    this.transport.close();
    this.setState('CLOSED');
  }

  private handleOpen(): void {
    bridgeLog('I', 'QB', `transport open (try ${this.reconnectTry})`);
    const login = this.opts.loginProvider ? this.opts.loginProvider() : null;
    if (login) {
      this.rawSend(login);
      // 로그인 응답을 받으면 handleLogin 에서 READY 로 넘어간다
      return;
    }
    // 로그인 없이 쓰는 모드 (사내 시세 전용 서버, 2018). 바로 READY
    this.onReady();
  }

  private onReady(): void {
    this.reconnectTry = 0;
    this.setState('READY');
    this.heartbeat.start();
    for (const s of this.subs.values()) s.sent = false;
    this.resubscribeAll();
  }

  private handleDisconnect(reason: string): void {
    bridgeLog('W', 'QB', `disconnected: ${reason}`);
    this.heartbeat.stop();
    this.recvBuf = new Uint8Array(0);
    if (this.fragTimer) {
      clearTimeout(this.fragTimer);
      this.fragTimer = null;
    }
    this.failAllPending(new BridgeError('E9005', reason));
    if (this.closedByUser) {
      this.setState('CLOSED');
      return;
    }
    this.scheduleReconnect();
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) return;
    if (this.reconnectTry >= RECONNECT_MAX_TRY) {
      this.setState('CLOSED');
      this.emitError(new BridgeError('E9005', `reconnect gave up after ${this.reconnectTry}`));
      return;
    }
    const idx = Math.min(this.reconnectTry, RECONNECT_BACKOFF_MS.length - 1);
    const wait = RECONNECT_BACKOFF_MS[idx];
    this.reconnectTry += 1;
    this.stats.reconnects += 1;
    this.setState('RECONNECTING');
    bridgeLog('I', 'QB', `reconnect in ${wait}ms (try ${this.reconnectTry})`);
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      try {
        this.transport.open();
      } catch (e) {
        bridgeLog('E', 'QB', `open failed ${String(e)}`);
        this.scheduleReconnect();
      }
    }, wait);
  }

  // ------------------------------------------------------------------ 실시간

  /**
   * 실시간 등록. key 는 보통 종목코드. 같은 TR·key 로 여러 번 등록하면 콜백만 늘고 서버 등록은 한 번.
   * 반환값은 해지할 때 쓰는 id.
   * 40개를 넘기면 서버가 조용히 무시하므로 여기서 막는다 (E2002).
   */
  subscribe(trCode: string, key: string, cb: PushCallback): number {
    const spec = getTrSpec(trCode);
    if (!spec) throw new BridgeError('E1004', trCode, trCode);
    if (!spec.push) throw new BridgeError('E2003', `${trCode} is not PUSH`, trCode);
    const serverKeys = this.distinctServerKeys();
    const pairKey = `${trCode}|${key}`;
    if (!serverKeys.has(pairKey) && serverKeys.size >= MAX_SUBSCRIPTIONS) {
      throw new BridgeError('E2002', `${serverKeys.size}/${MAX_SUBSCRIPTIONS}`, trCode);
    }
    const id = nextSubId++;
    const already = serverKeys.has(pairKey);
    this.subs.set(id, { id, trCode, key, cb, sent: already });
    if (!already && this.state === 'READY') {
      this.sendPushReg(trCode, key, true);
      const s = this.subs.get(id);
      if (s) s.sent = true;
    }
    bridgeLog('D', 'QB', `subscribe #${id} ${pairKey} (server=${this.distinctServerKeys().size})`);
    return id;
  }

  unsubscribe(id: number): void {
    const s = this.subs.get(id);
    if (!s) return;
    this.subs.delete(id);
    const stillUsed = Array.from(this.subs.values()).some((x) => x.trCode === s.trCode && x.key === s.key);
    if (!stillUsed && this.state === 'READY') {
      this.sendPushReg(s.trCode, s.key, false);
    }
    bridgeLog('D', 'QB', `unsubscribe #${id} ${s.trCode}|${s.key}`);
  }

  /** 화면 하나가 닫힐 때. 그 화면이 건 id 목록을 넘긴다 */
  unsubscribeMany(ids: readonly number[]): void {
    for (const id of ids) this.unsubscribe(id);
  }

  unsubscribeAll(): void {
    const pairs = this.distinctServerKeys();
    this.subs.clear();
    if (this.state !== 'READY') return;
    for (const pair of pairs) {
      const [trCode, key] = pair.split('|');
      this.sendPushReg(trCode, key, false);
    }
  }

  subscriptionCount(): number {
    return this.distinctServerKeys().size;
  }

  private distinctServerKeys(): Set<string> {
    const set = new Set<string>();
    for (const s of this.subs.values()) set.add(`${s.trCode}|${s.key}`);
    return set;
  }

  private resubscribeAll(): void {
    const done = new Set<string>();
    for (const s of this.subs.values()) {
      const pair = `${s.trCode}|${s.key}`;
      if (!done.has(pair)) {
        this.sendPushReg(s.trCode, s.key, true);
        done.add(pair);
      }
      s.sent = true;
    }
    if (done.size) bridgeLog('I', 'QB', `resubscribed ${done.size}`);
  }

  /** 등록·해지 전문. 바디는 key 를 12바이트로 채운 것 하나 */
  private sendPushReg(trCode: string, key: string, reg: boolean): void {
    const h = this.session.stamp(emptyHeader(reg ? MSG_PUSH_REG : MSG_PUSH_UNREG, trCode));
    this.rawSend(assemblePacket(h, padRightBytes(key, 12)));
  }

  // ------------------------------------------------------------------ 조회

  /**
   * 조회 요청. 응답이 오면 cb(null, body, header). 실패나 타임아웃이면 cb(err, null, header|null).
   * 반환값은 seqNo. cancelRequest 에 쓴다.
   */
  request(trCode: string, input: TrRecord, cb: RequestCallback, contKey = '', timeoutMs?: number): number {
    const spec = requireTrSpec(trCode);
    if (spec.push) throw new BridgeError('E1012', `${trCode} is PUSH`, trCode);
    if (this.state !== 'READY') {
      const err = new BridgeError('E9005', `state=${this.state}`, trCode);
      // 2018 HTS 호환: 동기 콜백 대신 다음 틱에 부른다
      setTimeout(() => cb(err, null, null), 0);
      return 0;
    }
    const body = encodeInput(spec, input);
    const base = emptyHeader(MSG_REQUEST, trCode);
    const h = this.session.stamp({ ...base, contFlag: contKey ? 'Y' : ' ', contKey });
    const wait = timeoutMs ?? timeoutFor(trCode);
    const timer = setTimeout(() => this.handleTimeout(h.seqNo), wait);
    this.pending.set(h.seqNo, { seqNo: h.seqNo, trCode, cb, timer, sentAt: Date.now() });
    this.rawSend(assemblePacket(h, body));
    return h.seqNo;
  }

  /**
   * 연속 조회를 끝까지 돈다. 행을 전부 모아서 한 번에 돌려준다.
   * MAX_CONT_QUERY 번 넘게 돌면 끊는다 (2020.03 서버가 contFlag 를 계속 Y 로 준 장애).
   */
  requestAll(trCode: string, input: TrRecord, cb: (err: BridgeError | null, head: TrRecord | null, rows: TrRecord[]) => void): void {
    const rows: TrRecord[] = [];
    let head: TrRecord | null = null;
    let count = 0;
    const step = (contKey: string) => {
      count += 1;
      if (count > MAX_CONT_QUERY) {
        cb(new BridgeError('E1008', `cont > ${MAX_CONT_QUERY}`, trCode), head, rows);
        return;
      }
      this.request(
        trCode,
        input,
        (err, body, header) => {
          if (err || !body || !header) {
            cb(err ?? new BridgeError('E9004', 'empty body', trCode), head, rows);
            return;
          }
          if (!head) head = body.head;
          rows.push(...body.rows);
          if (header.contFlag === 'Y' && header.contKey.trim()) {
            step(header.contKey);
          } else {
            cb(null, head, rows);
          }
        },
        contKey,
      );
    };
    step('');
  }

  cancelRequest(seqNo: number): void {
    const p = this.pending.get(seqNo);
    if (!p) return;
    clearTimeout(p.timer);
    this.pending.delete(seqNo);
  }

  pendingCount(): number {
    return this.pending.size;
  }

  private handleTimeout(seqNo: number): void {
    const p = this.pending.get(seqNo);
    if (!p) return;
    this.pending.delete(seqNo);
    this.stats.timeouts += 1;
    bridgeLog('W', 'QB', `timeout tr=${p.trCode} seq=${seqNo} after ${Date.now() - p.sentAt}ms`);
    this.safeCall(p.cb, new BridgeError('E9003', `seq=${seqNo}`, p.trCode), null, null);
  }

  private failAllPending(err: BridgeError): void {
    const list = Array.from(this.pending.values());
    this.pending.clear();
    for (const p of list) {
      clearTimeout(p.timer);
      this.safeCall(p.cb, new BridgeError(err.code, err.detail, p.trCode), null, null);
    }
  }

  private safeCall(cb: RequestCallback, err: BridgeError | null, body: DecodedBody | null, h: PacketHeader | null): void {
    try {
      cb(err, body, h);
    } catch (e) {
      // 화면 콜백 예외가 수신 루프를 끊으면 이후 시세가 전부 멈춘다 (2018.12 장애)
      bridgeLog('E', 'QB', `callback threw ${String(e)}`);
    }
  }

  // ------------------------------------------------------------------ 수신

  private handleReceive(bytes: Uint8Array): void {
    this.stats.recv += 1;
    this.recvBuf = this.recvBuf.length ? concatBytes([this.recvBuf, bytes]) : bytes;
    if (this.fragTimer) {
      clearTimeout(this.fragTimer);
      this.fragTimer = null;
    }
    // 한 번에 여러 전문이 붙어 올 수 있다
    for (;;) {
      let split: ReturnType<typeof splitPacket>;
      try {
        split = splitPacket(this.recvBuf);
      } catch (e) {
        const err = e instanceof BridgeError ? e : new BridgeError('E1006', String(e));
        bridgeLog('E', 'QB', `bad packet, drop buffer\n${hexDump(this.recvBuf, 96)}`);
        this.recvBuf = new Uint8Array(0);
        this.stats.dropped += 1;
        this.emitError(err);
        return;
      }
      if (!split) break;
      this.recvBuf = split.rest;
      this.dispatch(split.packet);
      if (!this.recvBuf.length) break;
    }
    if (this.recvBuf.length) {
      // 조각이 남았다. 일정 시간 안에 나머지가 안 오면 버린다
      this.fragTimer = setTimeout(() => {
        bridgeLog('W', 'QB', `fragment timeout, drop ${this.recvBuf.length} bytes`);
        this.recvBuf = new Uint8Array(0);
        this.stats.dropped += 1;
        this.fragTimer = null;
      }, FRAGMENT_WAIT_MS);
    }
  }

  private dispatch(p: Packet): void {
    const h = p.header;
    bridgeLog('D', 'QB', `recv ${describeHeader(h)}`);
    switch (h.msgType) {
      case MSG_LOGIN:
        this.handleLogin(p);
        break;
      case MSG_LOGOUT:
        // 서버가 먼저 끊는 경우 (중복 로그인 등)
        this.session.expire();
        this.emitError(new BridgeError(h.errCode.trim() || 'E0003', 'server logout'));
        break;
      case MSG_HEARTBEAT:
        this.heartbeat.ack();
        break;
      case MSG_RESPONSE:
        this.handleResponse(p);
        break;
      case MSG_PUSH:
        this.enqueuePush(p);
        break;
      case MSG_PUSH_REG:
      case MSG_PUSH_UNREG:
        // 등록·해지 응답. 오류일 때만 본다
        if (isErrorCode(h.errCode)) {
          this.emitError(new BridgeError(h.errCode.trim(), `push ${h.msgType === MSG_PUSH_REG ? 'reg' : 'unreg'}`, h.trCode));
        }
        break;
      case MSG_ERROR:
        this.handleErrorPacket(p);
        break;
      case MSG_REQUEST:
        // 서버가 요청을 보낼 일은 없다. 2019 테스트 서버가 에코로 돌려준 적이 있어 무시
        bridgeLog('W', 'QB', `unexpected REQUEST from server tr=${h.trCode}`);
        break;
      default:
        bridgeLog('W', 'QB', `unknown msgType ${String(h.msgType)}`);
        break;
    }
  }

  private handleLogin(p: Packet): void {
    try {
      this.session.handleLoginResponse(p.header, p.body);
      this.onReady();
    } catch (e) {
      const err = e instanceof BridgeError ? e : new BridgeError('E0001', String(e));
      this.emitError(err);
      if (isRetryable(err.code)) {
        this.handleDisconnect(`login retry ${err.code}`);
      } else {
        this.closedByUser = true;
        this.transport.close();
        this.setState('CLOSED');
      }
    }
  }

  private handleResponse(p: Packet): void {
    const h = p.header;
    const pend = this.pending.get(h.seqNo);
    if (!pend) {
      // 타임아웃 뒤 늦게 온 응답. 버린다
      bridgeLog('W', 'QB', `late response tr=${h.trCode} seq=${h.seqNo}`);
      this.stats.dropped += 1;
      return;
    }
    clearTimeout(pend.timer);
    this.pending.delete(h.seqNo);
    if (isErrorCode(h.errCode)) {
      if (h.errCode.trim() === 'E0002') this.session.expire();
      this.safeCall(pend.cb, new BridgeError(h.errCode.trim(), '', h.trCode), null, h);
      return;
    }
    const spec = getTrSpec(h.trCode || pend.trCode);
    if (!spec) {
      this.safeCall(pend.cb, new BridgeError('E1004', h.trCode, h.trCode), null, h);
      return;
    }
    let body: DecodedBody;
    try {
      body = decodeBody(spec, p.body);
    } catch (e) {
      this.safeCall(pend.cb, new BridgeError('E1006', String(e), h.trCode), null, h);
      return;
    }
    this.safeCall(pend.cb, null, body, h);
  }

  private handleErrorPacket(p: Packet): void {
    const h = p.header;
    const code = h.errCode.trim() || 'E9004';
    const err = new BridgeError(code, 'server error packet', h.trCode);
    const pend = h.seqNo ? this.pending.get(h.seqNo) : undefined;
    if (pend) {
      clearTimeout(pend.timer);
      this.pending.delete(h.seqNo);
      this.safeCall(pend.cb, err, null, h);
      return;
    }
    this.emitError(err);
    if (code === 'E0002') this.session.expire();
  }

  // ------------------------------------------------------------------ PUSH

  /**
   * PUSH 를 큐에 쌓고 다음 틱에 몰아서 처리한다.
   * 장 시작 직후 초당 수천 건이 와서 화면이 멈춘 적이 있어 2020.01 에 배치로 바꿨다.
   * 같은 TR·종목의 PUSH 가 큐에 여러 개 있으면 마지막 것만 쓴다 (호가·체결 모두).
   * 체결 PUSH 를 합치면 체결 틱이 빠지는데, 화면 요구사항이 "최신가만" 이라 그대로 둔다.
   */
  private enqueuePush(p: Packet): void {
    this.stats.push += 1;
    this.pushQueue.push(p);
    if (this.pushFlushScheduled) return;
    this.pushFlushScheduled = true;
    setTimeout(() => this.flushPush(), 0);
  }

  private flushPush(): void {
    this.pushFlushScheduled = false;
    const batch = this.pushQueue.splice(0, PUSH_BATCH_LIMIT);
    const latest = new Map<string, Packet>();
    for (const p of batch) {
      const key = `${p.header.trCode}|${this.pushKeyOf(p)}`;
      latest.set(key, p);
    }
    for (const [pair, p] of latest) {
      this.deliverPush(pair, p);
    }
    if (this.pushQueue.length) {
      this.pushFlushScheduled = true;
      setTimeout(() => this.flushPush(), 0);
    }
  }

  /** PUSH 바디 앞 12바이트가 key (종목코드 또는 계좌번호) */
  private pushKeyOf(p: Packet): string {
    let s = '';
    for (let i = 0; i < 12 && i < p.body.length; i++) s += String.fromCharCode(p.body[i]);
    return s.trim();
  }

  private deliverPush(pair: string, p: Packet): void {
    const [trCode, key] = pair.split('|');
    const spec: TrSpec | undefined = getTrSpec(trCode);
    if (!spec) {
      this.stats.dropped += 1;
      return;
    }
    let body: DecodedBody;
    try {
      body = decodeBody(spec, p.body);
    } catch (e) {
      bridgeLog('E', 'QB', `push decode fail ${trCode} ${String(e)}`);
      this.stats.dropped += 1;
      return;
    }
    let delivered = 0;
    for (const s of this.subs.values()) {
      if (s.trCode !== trCode) continue;
      // 계좌 PUSH(OR21xx)는 key 가 계좌번호라 등록 key 와 앞 11자리만 비교 (2018.09)
      const match = trCode.startsWith('OR21') ? s.key.slice(0, 11) === key.slice(0, 11) : s.key === key;
      if (!match) continue;
      try {
        s.cb(trCode, key, body.head, body.rows);
        delivered += 1;
      } catch (e) {
        bridgeLog('E', 'QB', `push cb threw #${s.id} ${String(e)}`);
      }
    }
    if (!delivered) this.stats.dropped += 1;
  }

  // ------------------------------------------------------------------ 송신

  private sendHeartbeat(): void {
    if (this.state !== 'READY') return;
    const h = this.session.stamp(emptyHeader(MSG_HEARTBEAT));
    this.rawSend(assemblePacket(h, new Uint8Array(0)));
  }

  private rawSend(bytes: Uint8Array): void {
    try {
      this.transport.send(bytes);
      this.stats.sent += 1;
    } catch (e) {
      bridgeLog('E', 'QB', `send failed ${String(e)}`);
      this.handleDisconnect('send failed');
    }
  }
}

/** 아무 데도 보내지 않는 전송 계층. 연결하면 바로 open 만 알린다 */
export class NullTransport implements BridgeTransport {
  onOpen: (() => void) | null = null;
  onReceive: ((bytes: Uint8Array) => void) | null = null;
  onClose: ((reason: string) => void) | null = null;
  readonly sentLog: Uint8Array[] = [];
  private opened = false;

  open(): void {
    this.opened = true;
    setTimeout(() => this.onOpen?.(), 0);
  }

  send(bytes: Uint8Array): void {
    if (!this.opened) throw new Error('NullTransport not open');
    // 최근 50개만 남긴다
    this.sentLog.push(bytes);
    if (this.sentLog.length > 50) this.sentLog.shift();
  }

  close(): void {
    if (!this.opened) return;
    this.opened = false;
    setTimeout(() => this.onClose?.('closed by client'), 0);
  }

  /** 테스트용: 서버가 보낸 것처럼 넣는다 */
  inject(bytes: Uint8Array): void {
    this.onReceive?.(bytes);
  }
}
