import type { Candle } from '../../types';
import { directionOf } from '../../lib/format';
import type { ChartScale } from './Chart';

interface CandlesProps {
  candles: Candle[];
  scale: ChartScale;
}

/** 캔들 하나 = 고저 선 + 시종 몸통. 상승 빨강, 하락 파랑. */
export function Candles({ candles, scale }: CandlesProps) {
  const bodyW = Math.max(3, scale.slot * 0.6);

  return (
    <g className="candles">
      {candles.map((c, i) => {
        const x = scale.x(i);
        const dir = directionOf(c.close - c.open);
        const top = scale.y(Math.max(c.open, c.close));
        const bottom = scale.y(Math.min(c.open, c.close));
        const h = Math.max(1, bottom - top);

        return (
          <g key={c.date} className={`candle ${dir}`}>
            <title>{`${c.date}  시 ${c.open}  고 ${c.high}  저 ${c.low}  종 ${c.close}`}</title>
            <line x1={x} x2={x} y1={scale.y(c.high)} y2={scale.y(c.low)} />
            <rect x={x - bodyW / 2} y={top} width={bodyW} height={h} />
          </g>
        );
      })}
    </g>
  );
}
