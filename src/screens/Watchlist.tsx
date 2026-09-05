import { useState } from 'react';
import type { WatchItem } from '../types';
import type { QuoteMap } from '../hooks/useQuoteFeed';
import { directionOf, formatPrice, formatRate } from '../lib/format';
import { Panel } from '../components/Panel';
import { PriceText } from '../components/PriceText';

/** 이 행 수를 넘으면 촘촘 모드로 그린다 */
const COMPACT_THRESHOLD = 6;
/** 목록 슬롯 높이(px). 보통 모드 6행(44px) = 촘촘 모드 8행(33px). 행 수가 바뀌어도 패널 높이는 이 값으로 고정된다 */
const LIST_HEIGHT = 264;

interface WatchlistProps {
  items: WatchItem[];
  quotes: QuoteMap;
  selected: string;
  onSelect: (symbol: string) => void;
}

/** 관심종목. 행을 누르면 호가·차트·주문 폼이 그 종목으로 바뀐다. */
export function Watchlist({ items, quotes, selected, onSelect }: WatchlistProps) {
  const [showAll, setShowAll] = useState(true);
  const visible = showAll ? items : items.slice(0, COMPACT_THRESHOLD);
  const compact = visible.length > COMPACT_THRESHOLD;

  return (
    <Panel
      title="관심종목"
      className="watchlist-panel"
      right={
        items.length > COMPACT_THRESHOLD ? (
          <button type="button" className="link-btn" onClick={() => setShowAll((v) => !v)}>
            {showAll ? `상위 ${COMPACT_THRESHOLD}개만` : `전체 ${items.length}개`}
          </button>
        ) : null
      }
    >
      <div className="watchlist-body" style={{ height: LIST_HEIGHT }}>
        <ul className={`watchlist${compact ? ' watchlist--compact' : ''}`}>
          {visible.map((item) => {
            const q = quotes[item.symbol];
            if (!q) return null;
            const dir = directionOf(q.changeRate);
            return (
              <li
                key={item.symbol}
                className={`watchlist-row${item.symbol === selected ? ' is-selected' : ''}`}
                onClick={() => onSelect(item.symbol)}
              >
                <span className="wl-name">
                  {item.name}
                  <small className="wl-code">{item.symbol}</small>
                  <small className="wl-sub">{formatPrice(q.price)}</small>
                </span>
                <PriceText className="wl-change" value={formatRate(q.changeRate)} direction={dir} />
              </li>
            );
          })}
        </ul>
      </div>
    </Panel>
  );
}
