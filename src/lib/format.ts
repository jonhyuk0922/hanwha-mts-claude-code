import type { Direction } from '../types';

const won = new Intl.NumberFormat('ko-KR');

/** 1234567 → "1,234,567" */
export function formatPrice(n: number): string {
  return won.format(n);
}

/** 1200 → "1,200" (수량도 천 단위 구분) */
export function formatQty(n: number): string {
  return won.format(n);
}

/** 0.71 → "+0.71%", -1.5 → "-1.50%", 0 → "0.00%" */
export function formatRate(rate: number): string {
  const sign = rate > 0 ? '+' : '';
  return `${sign}${rate.toFixed(2)}%`;
}

/** 500 → "+500", -1500 → "-1,500" */
export function formatChange(change: number): string {
  const sign = change > 0 ? '+' : change < 0 ? '-' : '';
  return `${sign}${won.format(Math.abs(change))}`;
}

export function directionOf(n: number): Direction {
  if (n > 0) return 'up';
  if (n < 0) return 'down';
  return 'flat';
}

/** 한국거래소 호가 단위 */
export function tickSize(price: number): number {
  if (price < 2_000) return 1;
  if (price < 5_000) return 5;
  if (price < 20_000) return 10;
  if (price < 50_000) return 50;
  if (price < 200_000) return 100;
  if (price < 500_000) return 500;
  return 1_000;
}

/** "2026-09-04" → "09.04" */
export function shortDate(iso: string): string {
  return iso.slice(5).replace('-', '.');
}

/** "2026-09-22T09:02:14+09:00" → "09:02" */
export function timeOf(iso: string): string {
  return iso.slice(11, 16);
}
