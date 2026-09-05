import type { Candle, Quote } from '../../types';
import { Panel } from '../../components/Panel';
import { Axes } from './Axes';
import { Candles } from './Candles';

export const CHART_W = 640;
export const CHART_H = 260;
export const PAD = { top: 12, right: 64, bottom: 24, left: 8 } as const;

/** 데이터 → 화면 좌표. Axes 와 Candles 가 같은 스케일을 쓴다. */
export interface ChartScale {
  x: (index: number) => number;
  y: (price: number) => number;
  slot: number;
  plotW: number;
  plotH: number;
  minPrice: number;
  maxPrice: number;
}

export function makeScale(candles: Candle[]): ChartScale {
  const plotW = CHART_W - PAD.left - PAD.right;
  const plotH = CHART_H - PAD.top - PAD.bottom;
  const lows = candles.map((c) => c.low);
  const highs = candles.map((c) => c.high);
  const rawMin = Math.min(...lows);
  const rawMax = Math.max(...highs);
  const margin = (rawMax - rawMin) * 0.06 || 1;
  const minPrice = rawMin - margin;
  const maxPrice = rawMax + margin;
  const slot = plotW / Math.max(candles.length, 1);

  return {
    x: (i) => PAD.left + slot * i + slot / 2,
    y: (p) => PAD.top + ((maxPrice - p) / (maxPrice - minPrice)) * plotH,
    slot,
    plotW,
    plotH,
    minPrice,
    maxPrice,
  };
}

interface ChartProps {
  candles: Candle[];
  quote: Quote;
}

/** 일봉 차트. 라이브러리 없이 SVG 를 직접 그린다. */
export function Chart({ candles, quote }: ChartProps) {
  const scale = makeScale(candles);
  const first = candles[0];
  const last = candles[candles.length - 1];

  return (
    <Panel
      title={`${quote.name} 일봉`}
      className="chart"
      right={
        first && last ? (
          <span className="muted">
            {first.date} ~ {last.date} · {candles.length}일
          </span>
        ) : null
      }
    >
      <svg
        className="chart-svg"
        viewBox={`0 0 ${CHART_W} ${CHART_H}`}
        width="100%"
        role="img"
        aria-label={`${quote.name} 일봉 차트`}
      >
        <Axes candles={candles} scale={scale} />
        <Candles candles={candles} scale={scale} />
      </svg>
    </Panel>
  );
}
