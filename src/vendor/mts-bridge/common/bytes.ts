// 교육용 가상 모듈. 실제 증권사 시스템과 무관하다.
/**
 * 바이트 처리 유틸.
 *
 * 서버 전문은 "구형 2바이트 한글" 규칙을 쓴다. 진짜 EUC-KR 이 아니라 그 흉내다.
 *   - 0x00~0x7F       : 1바이트 그대로
 *   - U+8000~U+FFFF   : 2바이트 (상위 바이트, 하위 바이트). 한글 음절이 이 범위에 들어간다
 *   - 그 외           : '?' 1바이트로 바꾼다 (이모지 등. 2019 고객 민원 있었음)
 *
 * 필드 길이는 전부 이 규칙의 바이트 수 기준이다. JS 문자열 길이와 다르다.
 */

const QUESTION = 0x3f;
const SPACE = 0x20;
const ZERO = 0x30;

/** 이 문자가 몇 바이트로 나가는지 */
export function legacyCharBytes(code: number): 1 | 2 {
  if (code <= 0x7f) return 1;
  if (code >= 0x8000 && code <= 0xffff) return 2;
  return 1;
}

/** 문자열 전체 바이트 수 (구형 규칙) */
export function legacyByteLength(s: string): number {
  let n = 0;
  for (let i = 0; i < s.length; i++) {
    n += legacyCharBytes(s.charCodeAt(i));
  }
  return n;
}

/** 문자열을 구형 규칙 바이트 배열로 */
export function encodeLegacy(s: string): Uint8Array {
  const out = new Uint8Array(legacyByteLength(s));
  let p = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c <= 0x7f) {
      out[p++] = c;
    } else if (c >= 0x8000 && c <= 0xffff) {
      out[p++] = (c >> 8) & 0xff;
      out[p++] = c & 0xff;
    } else {
      out[p++] = QUESTION;
    }
  }
  return out;
}

/** 구형 규칙 바이트 배열을 문자열로. end 는 포함하지 않는다 */
export function decodeLegacy(bytes: Uint8Array, start = 0, end = bytes.length): string {
  let s = '';
  let i = start;
  while (i < end) {
    const b = bytes[i];
    if (b <= 0x7f) {
      s += String.fromCharCode(b);
      i += 1;
    } else if (i + 1 < end) {
      s += String.fromCharCode((b << 8) | bytes[i + 1]);
      i += 2;
    } else {
      // 필드 끝에서 2바이트 문자가 잘린 경우. 서버가 가끔 이렇게 준다 (2018.10)
      s += '?';
      i += 1;
    }
  }
  return s;
}

/**
 * 오른쪽을 공백으로 채워 len 바이트로 맞춘다.
 * 넘치면 자르는데, 2바이트 문자 중간에서 자르지 않도록 한 바이트 덜 쓰고 공백을 넣는다.
 */
export function padRightBytes(s: string, len: number): Uint8Array {
  const out = new Uint8Array(len).fill(SPACE);
  let p = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    const w = legacyCharBytes(c);
    if (p + w > len) break;
    if (w === 1) {
      out[p++] = c <= 0x7f ? c : QUESTION;
    } else {
      out[p++] = (c >> 8) & 0xff;
      out[p++] = c & 0xff;
    }
  }
  return out;
}

/** 숫자 문자열을 왼쪽 0 채움으로 len 바이트. 넘치면 null (자르지 않는다) */
export function padLeftDigits(digits: string, len: number): Uint8Array | null {
  if (digits.length > len) return null;
  const out = new Uint8Array(len).fill(ZERO);
  const start = len - digits.length;
  for (let i = 0; i < digits.length; i++) {
    out[start + i] = digits.charCodeAt(i);
  }
  return out;
}

/** ASCII 로만 읽는다. 헤더처럼 한글이 없는 곳에 쓴다 */
export function readAscii(bytes: Uint8Array, offset: number, len: number): string {
  let s = '';
  const end = Math.min(bytes.length, offset + len);
  for (let i = offset; i < end; i++) s += String.fromCharCode(bytes[i]);
  return s;
}

/** ASCII 로 쓴다. 넘치는 부분은 버린다 */
export function writeAscii(target: Uint8Array, offset: number, s: string, len: number): void {
  for (let i = 0; i < len; i++) {
    const c = i < s.length ? s.charCodeAt(i) : SPACE;
    target[offset + i] = c <= 0x7f ? c : QUESTION;
  }
}

/** 여러 조각을 하나로 */
export function concatBytes(parts: readonly Uint8Array[]): Uint8Array {
  let total = 0;
  for (const p of parts) total += p.length;
  const out = new Uint8Array(total);
  let off = 0;
  for (const p of parts) {
    out.set(p, off);
    off += p.length;
  }
  return out;
}

/** 오른쪽 공백 제거. trim() 은 앞 공백까지 지워서 종목명이 깨진 적이 있어 따로 둔다 */
export function rtrim(s: string): string {
  let end = s.length;
  while (end > 0 && (s.charCodeAt(end - 1) === SPACE || s.charCodeAt(end - 1) === 0)) end--;
  return s.slice(0, end);
}

/** 1바이트 XOR 체크섬. 헤더 reserved 칸에 넣던 것. 2020 이후 서버가 안 본다 */
export function xorChecksum(bytes: Uint8Array, start = 0, end = bytes.length): number {
  let x = 0;
  for (let i = start; i < end; i++) x ^= bytes[i];
  return x & 0xff;
}

/** 로그용 16진 덤프. max 바이트까지만 */
export function hexDump(bytes: Uint8Array, max = 128): string {
  const rows: string[] = [];
  const end = Math.min(bytes.length, max);
  for (let r = 0; r < end; r += 16) {
    const hex: string[] = [];
    let txt = '';
    for (let i = r; i < Math.min(end, r + 16); i++) {
      hex.push(bytes[i].toString(16).padStart(2, '0'));
      txt += bytes[i] >= 0x20 && bytes[i] < 0x7f ? String.fromCharCode(bytes[i]) : '.';
    }
    rows.push(`${r.toString(16).padStart(4, '0')}  ${hex.join(' ').padEnd(47)}  ${txt}`);
  }
  if (bytes.length > max) rows.push(`... (${bytes.length - max} bytes more)`);
  return rows.join('\n');
}

/** 전부 공백(또는 0x00)인지. 빈 필드 판정에 쓴다 */
export function isBlank(bytes: Uint8Array, offset: number, len: number): boolean {
  for (let i = offset; i < offset + len && i < bytes.length; i++) {
    if (bytes[i] !== SPACE && bytes[i] !== 0) return false;
  }
  return true;
}

/** 전부 숫자 문자인지 */
export function isDigits(s: string): boolean {
  if (s.length === 0) return false;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c < 0x30 || c > 0x39) return false;
  }
  return true;
}
