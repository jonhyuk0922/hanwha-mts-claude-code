import type { Candle } from '../../types';
import { formatPrice, shortDate } from '../../lib/format';
import { CHART_H, CHART_W, PAD, type ChartScale } from './Chart';

const Y_TICKS = 5;
const X_EVERY = 5;

interface AxesProps {
  candles: Candle[];
  scale: ChartScale;
}

/** 가로 격자 + 오른쪽 가격 눈금 + 아래 날짜 눈금 */
export function Axes({ candles, scale }: AxesProps) {
  const ticks = Array.from({ length: Y_TICKS }, (_, i) => {
    const t = i / (Y_TICKS - 1);
    return scale.minPrice + (scale.maxPrice - scale.minPrice) * t;
  });
  const right = CHART_W - PAD.right;
  const bottom = CHART_H - PAD.bottom;

  return (
    <g className="axes">
      {ticks.map((price) => {
        const y = scale.y(price);
        return (
          <g key={price}>
            <line x1={PAD.left} x2={right} y1={y} y2={y} className="grid-line" />
            <text x={right + 6} y={y + 4} className="axis-label">
              {formatPrice(Math.round(price))}
            </text>
          </g>
        );
      })}

      <line x1={PAD.left} x2={right} y1={bottom} y2={bottom} className="axis-line" />

      {candles.map((c, i) =>
        i % X_EVERY === 0 ? (
          <text key={c.date} x={scale.x(i)} y={bottom + 16} textAnchor="middle" className="axis-label">
            {shortDate(c.date)}
          </text>
        ) : null,
      )}
    </g>
  );
}
