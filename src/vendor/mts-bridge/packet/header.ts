// 교육용 가상 모듈. 실제 증권사 시스템과 무관하다.
/**
 * 고정길이 전문 헤더 (64 bytes).
 *
 *  off len  이름        비고
 *  ---  ---  ----------  ------------------------------------------
 *    0    1  stx         0x02
 *    1    6  totalLen    헤더 + 바디 + ETX. 0 채움
 *    7    2  msgType     01 로그인 / 02 로그아웃 / 09 하트비트 / 10 요청 / 11 응답
 *                        20 PUSH / 21 PUSH 등록 / 22 PUSH 해지 / 99 오류
 *    9    6  trCode      TR 코드. 하트비트·로그인은 공백
 *   15    8  seqNo       요청 순번. 응답은 요청 순번을 그대로 돌려준다
 *   23   12  sessionId   로그인 응답으로 받은 값
 *   35    1  contFlag    ' ' 처음 / 'Y' 다음 있음 / 'N' 끝
 *   36   18  contKey     연속 조회 키. 서버가 준 값을 그대로 돌려준다
 *   54    5  errCode     정상은 공백. 오류는 E + 4자리
 *   59    1  compFlag    'Y' 압축. 2020 이후 항상 'N'
 *   60    1  encFlag     'Y' 암호화 바디
 *   61    3  reserved    구 체크섬 자리. 지금은 공백
 *
 * 전문 = 헤더(64) + 바디(TR 입력/출력 블록) + ETX(1)
 */
import type { ContFlag, MsgType, Packet, PacketHeader } from './types';
import {
  ERR_NONE,
  ETX,
  HDR_LEN_CONTKEY,
  HDR_LEN_ERRCODE,
  HDR_LEN_MSGTYPE,
  HDR_LEN_SEQ,
  HDR_LEN_SESSION,
  HDR_LEN_TOTAL,
  HDR_LEN_TRCODE,
  HEADER_LENGTH,
  MAX_PACKET_LENGTH,
  MAX_SEQ_NO,
  STX,
} from '../common/constants';
import { isDigits, readAscii, writeAscii } from '../common/bytes';
import { BridgeError, bridgeLog } from '../common/errors';

const OFF_STX = 0;
const OFF_TOTAL = 1;
const OFF_MSGTYPE = 7;
const OFF_TRCODE = 9;
const OFF_SEQ = 15;
const OFF_SESSION = 23;
const OFF_CONTFLAG = 35;
const OFF_CONTKEY = 36;
const OFF_ERRCODE = 54;
const OFF_COMP = 59;
const OFF_ENC = 60;
const OFF_RESERVED = 61;
const LEN_RESERVED = 3;

const VALID_MSG_TYPES: readonly MsgType[] = ['01', '02', '09', '10', '11', '20', '21', '22', '99'];

export function isMsgType(s: string): s is MsgType {
  return (VALID_MSG_TYPES as readonly string[]).includes(s);
}

function toContFlag(s: string): ContFlag {
  if (s === 'Y' || s === 'N') return s;
  return ' ';
}

/** 헤더 기본값. 필요한 것만 덮어써서 쓴다 */
export function emptyHeader(msgType: MsgType, trCode = ''): PacketHeader {
  return {
    stx: STX,
    totalLen: 0,
    msgType,
    trCode,
    seqNo: 0,
    sessionId: '',
    contFlag: ' ',
    contKey: '',
    errCode: ERR_NONE,
    compressed: false,
    encrypted: false,
    reserved: '',
  };
}

/** 헤더 64바이트를 읽는다. 형식이 틀리면 BridgeError */
export function parseHeader(bytes: Uint8Array): PacketHeader {
  if (bytes.length < HEADER_LENGTH) {
    throw new BridgeError('E1001', `len=${bytes.length}`);
  }
  if (bytes[OFF_STX] !== STX) {
    throw new BridgeError('E1002', `first=0x${bytes[OFF_STX].toString(16)}`);
  }
  const totalStr = readAscii(bytes, OFF_TOTAL, HDR_LEN_TOTAL);
  if (!isDigits(totalStr)) throw new BridgeError('E1005', `totalLen='${totalStr}'`);
  const msgTypeStr = readAscii(bytes, OFF_MSGTYPE, HDR_LEN_MSGTYPE);
  if (!isMsgType(msgTypeStr)) throw new BridgeError('E1012', `msgType='${msgTypeStr}'`);
  const seqStr = readAscii(bytes, OFF_SEQ, HDR_LEN_SEQ);
  // 2018.08 하트비트 응답은 seq 가 공백으로 온다. 0 으로 본다
  const seqNo = seqStr.trim() === '' ? 0 : Number(seqStr);
  if (!Number.isFinite(seqNo)) throw new BridgeError('E1006', `seq='${seqStr}'`);

  return {
    stx: bytes[OFF_STX],
    totalLen: Number(totalStr),
    msgType: msgTypeStr,
    trCode: readAscii(bytes, OFF_TRCODE, HDR_LEN_TRCODE).trim(),
    seqNo,
    sessionId: readAscii(bytes, OFF_SESSION, HDR_LEN_SESSION).trim(),
    contFlag: toContFlag(readAscii(bytes, OFF_CONTFLAG, 1)),
    contKey: readAscii(bytes, OFF_CONTKEY, HDR_LEN_CONTKEY),
    errCode: readAscii(bytes, OFF_ERRCODE, HDR_LEN_ERRCODE),
    compressed: readAscii(bytes, OFF_COMP, 1) === 'Y',
    encrypted: readAscii(bytes, OFF_ENC, 1) === 'Y',
    reserved: readAscii(bytes, OFF_RESERVED, LEN_RESERVED),
  };
}

/** 헤더를 64바이트로 쓴다. totalLen 은 bodyLen 으로 계산해서 덮어쓴다 */
export function encodeHeader(h: PacketHeader, bodyLen: number): Uint8Array {
  const out = new Uint8Array(HEADER_LENGTH);
  const total = HEADER_LENGTH + bodyLen + 1;
  if (total > MAX_PACKET_LENGTH) {
    throw new BridgeError('E1005', `total=${total} > ${MAX_PACKET_LENGTH}`, h.trCode);
  }
  if (h.seqNo < 0 || h.seqNo > MAX_SEQ_NO) {
    throw new BridgeError('E1009', `seq=${h.seqNo}`, h.trCode);
  }
  out[OFF_STX] = STX;
  writeAscii(out, OFF_TOTAL, String(total).padStart(HDR_LEN_TOTAL, '0'), HDR_LEN_TOTAL);
  writeAscii(out, OFF_MSGTYPE, h.msgType, HDR_LEN_MSGTYPE);
  writeAscii(out, OFF_TRCODE, h.trCode, HDR_LEN_TRCODE);
  writeAscii(out, OFF_SEQ, String(h.seqNo).padStart(HDR_LEN_SEQ, '0'), HDR_LEN_SEQ);
  writeAscii(out, OFF_SESSION, h.sessionId, HDR_LEN_SESSION);
  writeAscii(out, OFF_CONTFLAG, h.contFlag, 1);
  writeAscii(out, OFF_CONTKEY, h.contKey, HDR_LEN_CONTKEY);
  writeAscii(out, OFF_ERRCODE, h.errCode || ERR_NONE, HDR_LEN_ERRCODE);
  writeAscii(out, OFF_COMP, h.compressed ? 'Y' : 'N', 1);
  writeAscii(out, OFF_ENC, h.encrypted ? 'Y' : 'N', 1);
  writeAscii(out, OFF_RESERVED, h.reserved, LEN_RESERVED);
  return out;
}

/** 헤더 + 바디 + ETX 를 한 덩어리로 */
export function assemblePacket(h: PacketHeader, body: Uint8Array): Uint8Array {
  const head = encodeHeader(h, body.length);
  const out = new Uint8Array(head.length + body.length + 1);
  out.set(head, 0);
  out.set(body, head.length);
  out[out.length - 1] = ETX;
  return out;
}

/**
 * 받은 바이트에서 전문 하나를 떼어 낸다.
 * 모자라면 null (조각 대기). 남는 바이트는 rest 로 돌려준다.
 * 2019.07 모바일 망에서 두 전문이 한 번에 붙어 오는 경우가 있어 rest 를 추가했다.
 */
export function splitPacket(buf: Uint8Array): { packet: Packet; rest: Uint8Array } | null {
  if (buf.length < HEADER_LENGTH) return null;
  const header = parseHeader(buf);
  if (header.totalLen < HEADER_LENGTH + 1) {
    throw new BridgeError('E1005', `totalLen=${header.totalLen}`, header.trCode);
  }
  if (buf.length < header.totalLen) return null;
  const etxPos = header.totalLen - 1;
  if (buf[etxPos] !== ETX) {
    // 서버 구버전은 ETX 를 빼먹는 경우가 있었다. 경고만 남기고 넘어간다 (2018.05)
    bridgeLog('W', 'HD', `ETX missing tr=${header.trCode} seq=${header.seqNo}`);
  }
  const body = buf.slice(HEADER_LENGTH, etxPos);
  const rest = buf.slice(header.totalLen);
  return { packet: { header, body }, rest };
}

/** 로그용 한 줄 요약 */
export function describeHeader(h: PacketHeader): string {
  return [
    `type=${h.msgType}(${msgTypeName(h.msgType)})`,
    `tr=${h.trCode || '-'}`,
    `seq=${h.seqNo}`,
    `len=${h.totalLen}`,
    h.contFlag !== ' ' ? `cont=${h.contFlag}` : '',
    h.errCode.trim() ? `err=${h.errCode}` : '',
  ]
    .filter(Boolean)
    .join(' ');
}

export function msgTypeName(t: MsgType): string {
  switch (t) {
    case '01':
      return 'LOGIN';
    case '02':
      return 'LOGOUT';
    case '09':
      return 'HEARTBEAT';
    case '10':
      return 'REQUEST';
    case '11':
      return 'RESPONSE';
    case '20':
      return 'PUSH';
    case '21':
      return 'PUSH_REG';
    case '22':
      return 'PUSH_UNREG';
    case '99':
      return 'ERROR';
    default:
      return 'UNKNOWN';
  }
}
