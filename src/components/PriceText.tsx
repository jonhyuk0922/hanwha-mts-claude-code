import type { Direction } from '../types';

interface PriceTextProps {
  value: string;
  direction: Direction;
  className?: string;
}

/** 상승 빨강 · 하락 파랑 · 보합 회색으로 칠한 숫자 */
export function PriceText({ value, direction, className }: PriceTextProps) {
  return <span className={`num ${direction}${className ? ` ${className}` : ''}`}>{value}</span>;
}
