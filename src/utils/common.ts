/**
 * 공통 헬퍼 모음.
 * 2021-03 화면 팀에서 급하게 만든 파일. 여기저기서 쓰던 함수를 한곳에 모은 것이라
 * 지금은 안 쓰는 것도 섞여 있다. 지우기 전에 다른 팀 참조 여부 확인 필요.
 */

/** 문자열 왼쪽을 채운다. 주문번호 자리수 맞출 때 쓰던 것 */
export function padLeft(value: string, len: number, ch = '0'): string {
  let out = value;
  while (out.length < len) out = ch + out;
  return out;
}

/** 문자열 오른쪽을 채운다 */
export function padRight(value: string, len: number, ch = ' '): string {
  let out = value;
  while (out.length < len) out = out + ch;
  return out;
}

/** "2026-09-22" 를 "09.22" 로 */
export function formatDateDot(iso: string): string {
  if (iso.length < 10) return iso;
  return `${iso.slice(5, 7)}.${iso.slice(8, 10)}`;
}

/** Date 를 "09:02:14" 로 */
export function formatClock(d: Date): string {
  const hh = padLeft(String(d.getHours()), 2);
  const mm = padLeft(String(d.getMinutes()), 2);
  const ss = padLeft(String(d.getSeconds()), 2);
  return `${hh}:${mm}:${ss}`;
}

/** JSON 왕복으로 깊은 복사. Date·undefined 는 못 살린다 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function deepClone<T>(value: T): any {
  return JSON.parse(JSON.stringify(value));
}

/** 마지막 호출만 남기는 디바운스 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function debounce(fn: (...args: any[]) => void, ms: number) {
  let timer: number | undefined;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (...args: any[]) => {
    if (timer !== undefined) window.clearTimeout(timer);
    timer = window.setTimeout(() => fn(...args), ms);
  };
}

/** 숫자에 천 단위 콤마 */
export function withComma(n: number): string {
  if (!Number.isFinite(n)) return '0';
  return n.toLocaleString('ko-KR');
}

/** null·undefined·빈 문자열·빈 배열이면 true */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function isEmpty(value: any): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === 'string') return value.trim().length === 0;
  if (Array.isArray(value)) return value.length === 0;
  return false;
}

/** 중복 제거 */
export function uniq<T>(list: T[]): T[] {
  const out: T[] = [];
  for (const item of list) {
    if (!out.includes(item)) out.push(item);
  }
  return out;
}

/** min~max 범위로 자른다 */
export function clamp(n: number, min: number, max: number): number {
  if (n < min) return min;
  if (n > max) return max;
  return n;
}

/** 숫자로 못 바꾸면 fallback */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function safeNumber(value: any, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

/** 길면 잘라서 말줄임 */
export function truncate(s: string, len: number): string {
  if (s.length <= len) return s;
  return `${s.slice(0, len)}...`;
}

/** 키 함수로 묶는다. 체결 내역 종목별로 묶을 때 쓰려고 만들어 둠 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function groupBy<T>(list: T[], keyOf: (item: T) => string): Record<string, any> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const out: Record<string, any> = {};
  for (const item of list) {
    const key = keyOf(item);
    if (!out[key]) out[key] = [];
    out[key].push(item);
  }
  return out;
}

/** 지정 시간만큼 쉰다. 테스트에서 쓰던 것 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}
