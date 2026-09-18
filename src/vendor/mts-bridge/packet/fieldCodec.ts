// 교육용 가상 모듈. 실제 증권사 시스템과 무관하다.
/**
 * TR 블록 필드 인코더·디코더. 순수 함수만 둔다.
 *
 * 필드 형식은 packet/types.ts 주석 참고.
 * 2017 이전 TR 은 필드명이 대문자_밑줄이다. 인코딩할 때 record 키는 둘 다 받아 준다
 * (lastPx 로 넣어도 LAST_PX 필드에 들어간다). 디코딩 결과 키는 항상 camelCase 로 맞춘다.
 */
import type { DecodedBody, FieldTuple, FieldValue, TrBlock, TrRecord, TrRowsBlock, TrSpec } from './types';
import { concatBytes, decodeLegacy, isBlank, padLeftDigits, padRightBytes, rtrim } from '../common/bytes';
import { BridgeError } from '../common/errors';

/** LAST_PX → lastPx */
export function toCamel(name: string): string {
  if (!/^[A-Z0-9_]+$/.test(name)) return name;
  return name.toLowerCase().replace(/_([a-z0-9])/g, (_, c: string) => c.toUpperCase());
}

/** lastPx → LAST_PX */
export function toSnakeUpper(name: string): string {
  return name.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toUpperCase();
}

/** record 에서 필드 값을 찾는다. 구·신 이름 둘 다 본다 */
function lookup(rec: TrRecord, name: string): FieldValue | undefined {
  if (name in rec) return rec[name];
  const camel = toCamel(name);
  if (camel in rec) return rec[camel];
  const upper = toSnakeUpper(name);
  if (upper in rec) return rec[upper];
  return undefined;
}

/** 필드 하나를 바이트로 */
export function encodeField(field: FieldTuple, value: FieldValue | undefined, trCode = ''): Uint8Array {
  const [name, type, , length, scale = 0] = field;

  if (value === undefined || value === '') {
    // 빈 값: 문자는 공백, 숫자는 0 채움. D/T 는 공백 (서버가 공백을 "없음" 으로 본다)
    if (type === 'N' || type === 'S' || type === 'F') {
      const z = padLeftDigits('0', length);
      if (!z) throw new BridgeError('E1007', name, trCode);
      return z;
    }
    return padRightBytes('', length);
  }

  switch (type) {
    case 'A':
      return padRightBytes(String(value), length);

    case 'N': {
      const n = toNumber(value, name, trCode);
      if (n < 0) throw new BridgeError('E1006', `${name} 음수 불가 (${n})`, trCode);
      const out = padLeftDigits(String(Math.trunc(n)), length);
      if (!out) throw new BridgeError('E1007', `${name}=${n} len=${length}`, trCode);
      return out;
    }

    case 'S': {
      const n = Math.trunc(toNumber(value, name, trCode));
      const sign = n < 0 ? '-' : '+';
      const digits = padLeftDigits(String(Math.abs(n)), length - 1);
      if (!digits) throw new BridgeError('E1007', `${name}=${n} len=${length}`, trCode);
      return concatBytes([new Uint8Array([sign.charCodeAt(0)]), digits]);
    }

    case 'F': {
      const n = toNumber(value, name, trCode);
      // 부호는 별도 필드(chgSign 등)로 보낸다. 여기서는 절대값만
      const scaled = Math.round(Math.abs(n) * Math.pow(10, scale));
      const out = padLeftDigits(String(scaled), length);
      if (!out) throw new BridgeError('E1007', `${name}=${n} len=${length}`, trCode);
      return out;
    }

    case 'D': {
      const s = String(value).replace(/-/g, '');
      if (!/^\d{8}$/.test(s)) throw new BridgeError('E1006', `${name} 일자 형식 (${value})`, trCode);
      return padRightBytes(s, length);
    }

    case 'T': {
      const s = String(value).replace(/:/g, '').replace('.', '');
      if (!/^\d+$/.test(s)) throw new BridgeError('E1006', `${name} 시각 형식 (${value})`, trCode);
      // 9자리 시각을 6자리 필드에 넣으면 밀리초를 버린다. 반대는 0 을 붙인다
      const fitted = s.length >= length ? s.slice(0, length) : s.padEnd(length, '0');
      return padRightBytes(fitted, length);
    }

    default:
      throw new BridgeError('E1006', `${name} 알 수 없는 형식`, trCode);
  }
}

function toNumber(value: FieldValue, name: string, trCode: string): number {
  const n = typeof value === 'number' ? value : Number(String(value).replace(/,/g, '').trim());
  if (!Number.isFinite(n)) throw new BridgeError('E1006', `${name} 숫자 아님 (${value})`, trCode);
  return n;
}

/** 필드 하나를 읽는다. base 는 블록 시작 위치 */
export function decodeField(field: FieldTuple, bytes: Uint8Array, base = 0): FieldValue {
  const [, type, offset, length, scale = 0] = field;
  const start = base + offset;
  const end = start + length;
  if (end > bytes.length) return type === 'A' || type === 'D' || type === 'T' ? '' : 0;

  switch (type) {
    case 'A':
    case 'D':
    case 'T':
      return rtrim(decodeLegacy(bytes, start, end));

    case 'N': {
      if (isBlank(bytes, start, length)) return 0;
      const n = Number(decodeLegacy(bytes, start, end).trim());
      return Number.isFinite(n) ? n : 0;
    }

    case 'S': {
      if (isBlank(bytes, start, length)) return 0;
      const s = decodeLegacy(bytes, start, end).trim();
      // 2018 이전 서버는 부호 자리에 공백을 준다. 양수로 본다
      const sign = s[0] === '-' ? -1 : 1;
      const body = s[0] === '-' || s[0] === '+' ? s.slice(1) : s;
      const n = Number(body);
      return Number.isFinite(n) ? sign * n : 0;
    }

    case 'F': {
      if (isBlank(bytes, start, length)) return 0;
      const n = Number(decodeLegacy(bytes, start, end).trim());
      if (!Number.isFinite(n)) return 0;
      return scale > 0 ? n / Math.pow(10, scale) : n;
    }

    default:
      return '';
  }
}

/** 블록 하나를 바이트로. 필드 오프셋 순서대로 채우고 남는 자리는 공백 */
export function encodeBlock(block: TrBlock, rec: TrRecord, trCode = ''): Uint8Array {
  const out = new Uint8Array(block.len).fill(0x20);
  for (const f of block.fields) {
    const bytes = encodeField(f, lookup(rec, f[0]), trCode);
    if (f[2] + bytes.length > block.len) {
      throw new BridgeError('E1007', `${f[0]} off=${f[2]} block=${block.len}`, trCode);
    }
    out.set(bytes, f[2]);
  }
  return out;
}

/** 블록 하나를 읽는다. 키는 camelCase */
export function decodeBlock(block: TrBlock, bytes: Uint8Array, base = 0): TrRecord {
  const rec: TrRecord = {};
  for (const f of block.fields) {
    if (f[0] === 'filler' || f[0] === 'FILLER') continue;
    rec[toCamel(f[0])] = decodeField(f, bytes, base);
  }
  return rec;
}

/**
 * 출력 바디 전체를 읽는다. 반복 블록은 head.rowCnt 만큼 (없으면 occurs 전부, 빈 줄은 버림).
 * 2020.02 서버가 occurs 보다 적게 주는데 rowCnt 를 안 채우는 TR 이 있어서 빈 줄 판정을 넣었다.
 */
export function decodeBody(spec: TrSpec, bytes: Uint8Array): DecodedBody {
  const head = decodeBlock(spec.output, bytes, 0);
  const rows: TrRecord[] = [];
  const rb: TrRowsBlock | undefined = spec.rows;
  if (rb) {
    const declared = typeof head.rowCnt === 'number' && head.rowCnt > 0 ? head.rowCnt : rb.occurs;
    const count = Math.min(declared, rb.occurs);
    for (let i = 0; i < count; i++) {
      const base = spec.output.len + i * rb.len;
      if (base + rb.len > bytes.length) break;
      if (isBlank(bytes, base, rb.len)) continue;
      rows.push(decodeBlock(rb, bytes, base));
    }
  }
  return { head, rows };
}

/** 입력 바디를 만든다. PUSH TR 은 입력이 없어서 빈 배열 */
export function encodeInput(spec: TrSpec, rec: TrRecord): Uint8Array {
  if (!spec.input) return new Uint8Array(0);
  return encodeBlock(spec.input, rec, spec.code);
}

/**
 * 스펙 자체 검사. 오프셋이 이어지는지, 합이 len 과 같은지.
 * 생성기가 틀린 적이 있어서(2019.04 rev 72) 로딩 때 한 번 돌린다.
 * 문제 목록을 돌려준다. 빈 배열이면 정상.
 */
export function validateBlock(block: TrBlock, label: string): string[] {
  const problems: string[] = [];
  let expected = 0;
  const seen = new Set<string>();
  for (const [name, type, offset, length, scale] of block.fields) {
    if (offset !== expected) problems.push(`${label}.${name}: offset ${offset} != ${expected}`);
    if (length <= 0) problems.push(`${label}.${name}: length ${length}`);
    if (type === 'F' && (scale === undefined || scale < 0)) problems.push(`${label}.${name}: F 인데 scale 없음`);
    if (type === 'S' && length < 2) problems.push(`${label}.${name}: S 는 2자리 이상`);
    if (seen.has(name) && name.toLowerCase() !== 'filler') problems.push(`${label}.${name}: 중복`);
    seen.add(name);
    expected = offset + length;
  }
  if (expected !== block.len) problems.push(`${label}: 필드 합 ${expected} != len ${block.len}`);
  return problems;
}

export function validateSpec(spec: TrSpec): string[] {
  const problems: string[] = [];
  if (!/^[A-Z]{2}\d{4}$/.test(spec.code)) problems.push(`${spec.code}: 코드 형식`);
  if (spec.push && spec.input) problems.push(`${spec.code}: PUSH 인데 input 있음`);
  if (spec.input) problems.push(...validateBlock(spec.input, `${spec.code}.input`));
  problems.push(...validateBlock(spec.output, `${spec.code}.output`));
  if (spec.rows) {
    problems.push(...validateBlock(spec.rows, `${spec.code}.rows`));
    if (spec.rows.occurs <= 0) problems.push(`${spec.code}.rows: occurs ${spec.rows.occurs}`);
  }
  return problems;
}

/** 출력 바디 최대 길이 (반복 블록 전부 찼을 때) */
export function maxOutputLength(spec: TrSpec): number {
  return spec.output.len + (spec.rows ? spec.rows.len * spec.rows.occurs : 0);
}

/** 필드 이름으로 튜플 찾기. 구·신 이름 둘 다 */
export function findField(block: TrBlock, name: string): FieldTuple | undefined {
  const upper = toSnakeUpper(name);
  return block.fields.find((f) => f[0] === name || f[0] === upper || toCamel(f[0]) === name);
}
