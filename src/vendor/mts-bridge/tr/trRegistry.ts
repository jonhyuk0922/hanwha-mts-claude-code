// 교육용 가상 모듈. 실제 증권사 시스템과 무관하다.
/**
 * TR 레지스트리. 생성 파일 4개를 한 맵으로 모은다.
 *
 * 처음 getTrSpec 을 부를 때 한 번만 만든다 (앱 시작 시간 때문에 2019.02 지연 로딩으로 바꿈).
 * 스펙 검증(validateSpec)은 개발 모드에서만 돌렸었는데, 플래그가 사라져서 지금은 항상 돈다.
 */
import type { RawTrSpec, TrKind, TrSpec } from '../packet/types';
import { TR_SPEC_QUOTE } from './trSpec.quote.generated';
import { TR_SPEC_ORDER } from './trSpec.order.generated';
import { TR_SPEC_ACCOUNT } from './trSpec.account.generated';
import { TR_SPEC_MASTER } from './trSpec.master.generated';
import { validateSpec } from '../packet/fieldCodec';
import { BridgeError, bridgeLog } from '../common/errors';
import { DEFAULT_TIMEOUT_MS } from '../common/constants';

let registry: Map<string, TrSpec> | null = null;
let problems: string[] = [];

function build(): Map<string, TrSpec> {
  const map = new Map<string, TrSpec>();
  const load = (list: readonly RawTrSpec[], kind: TrKind) => {
    for (const raw of list) {
      if (map.has(raw.code)) {
        // 같은 코드가 두 파일에 있으면 뒤에 온 것이 이긴다. 2020.05 OR/AC 겹침 사고
        bridgeLog('W', 'TR', `duplicate code ${raw.code} (${kind})`);
      }
      map.set(raw.code, { ...raw, kind });
    }
  };
  load(TR_SPEC_QUOTE, 'QUOTE');
  load(TR_SPEC_ORDER, 'ORDER');
  load(TR_SPEC_ACCOUNT, 'ACCOUNT');
  load(TR_SPEC_MASTER, 'MASTER');

  problems = [];
  for (const spec of map.values()) {
    const p = validateSpec(spec);
    if (p.length) problems.push(...p);
  }
  if (problems.length) bridgeLog('W', 'TR', `spec problems: ${problems.length}`);
  bridgeLog('I', 'TR', `registry loaded: ${map.size} TR`);
  return map;
}

function reg(): Map<string, TrSpec> {
  if (!registry) registry = build();
  return registry;
}

export function getTrSpec(code: string): TrSpec | undefined {
  return reg().get(code.trim());
}

export function requireTrSpec(code: string): TrSpec {
  const spec = getTrSpec(code);
  if (!spec) throw new BridgeError('E1004', code, code);
  if (spec.deprecated) bridgeLog('W', 'TR', `deprecated TR used: ${code} ${spec.name}`);
  return spec;
}

export function allTrCodes(): string[] {
  return Array.from(reg().keys()).sort();
}

export function specProblems(): readonly string[] {
  reg();
  return problems;
}

/** 코드 접두어로 종류 판정. 레지스트리에 없는 코드(서버 신규 TR)도 판정은 해 준다 */
export function kindOfCode(code: string): TrKind {
  switch (code.slice(0, 2)) {
    case 'QX':
      return 'QUOTE';
    case 'QY': // 2017 구 시세 접두어. 서버에서 QX 로 바꿔 준다
      return 'QUOTE';
    case 'OR':
      return 'ORDER';
    case 'OX': // 2018 구 주문 접두어
      return 'ORDER';
    case 'AC':
      return 'ACCOUNT';
    case 'AQ': // 계좌 조회 전용 서버 분리 시도 (2019, 무산). 코드만 남음
      return 'ACCOUNT';
    case 'MS':
      return 'MASTER';
    default:
      return 'UNKNOWN';
  }
}

export function isPushTr(code: string): boolean {
  const spec = getTrSpec(code);
  return spec?.push === true;
}

/**
 * TR 별 응답 대기 시간.
 * 숫자는 운영하면서 하나씩 늘린 값이다. 근거 문서 없음.
 */
export function timeoutFor(code: string): number {
  switch (code) {
    case 'OR2001':
    case 'OR2002':
      return 7000; // 매수·매도. 거래소 왕복
    case 'OR2003':
    case 'OR2004':
      return 8000; // 정정·취소는 원주문 조회까지 해서 더 늦다 (2019.02)
    case 'AC3002':
      return 10000; // 잔고. 종목 많은 계좌에서 타임아웃 민원
    case 'AC3003':
      return 6000;
    case 'MS4001':
      return 30000; // 마스터 전체. 장 시작 전에만 부른다
    case 'MS4002':
      return 4000;
    case 'QX1001':
    case 'QX1002':
      return 3000;
    case 'QX1003':
      return 4000;
    default:
      break;
  }
  switch (kindOfCode(code)) {
    case 'ORDER':
      return 7000;
    case 'ACCOUNT':
      return 8000;
    case 'MASTER':
      return 20000;
    default:
      return DEFAULT_TIMEOUT_MS;
  }
}

/**
 * 연속 조회 가능한 TR 인지. 입력에 contKey 필드가 있으면 된다.
 * 대문자 TR 은 CONT_KEY.
 */
export function supportsContinuation(code: string): boolean {
  const spec = getTrSpec(code);
  if (!spec?.input) return false;
  return spec.input.fields.some((f) => f[0] === 'contKey' || f[0] === 'CONT_KEY');
}

/** 로그·디버그 화면용 요약 */
export function describeTr(code: string): string {
  const spec = getTrSpec(code);
  if (!spec) return `${code} (미등록)`;
  const parts = [`${spec.code} ${spec.name}`, spec.kind];
  if (spec.push) parts.push('PUSH');
  if (spec.deprecated) parts.push('사용중지');
  if (spec.input) parts.push(`in=${spec.input.len}`);
  parts.push(`out=${spec.output.len}`);
  if (spec.rows) parts.push(`rows=${spec.rows.occurs}x${spec.rows.len}`);
  return parts.join(' ');
}
