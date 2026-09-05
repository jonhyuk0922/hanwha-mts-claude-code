import { useState } from 'react';
import type { WatchItem } from '../types';
import type { QuoteMap } from '../hooks/useQuoteFeed';
import { directionOf, formatPrice, formatRate } from '../lib/format';
import { sortByChange, toggleDirection, type SortDirection } from '../lib/sortByChange';
import { readSortState, writeSortState } from '../lib/sortState';
import { Panel } from '../components/Panel';
import { PriceText } from '../components/PriceText';

/** 이 행 수를 넘으면 촘촘 모드로 그린다 */
const COMPACT_THRESHOLD = 6;
/** 목록 슬롯 높이(px). 보통 모드 6행(44px) = 촘촘 모드 8행(33px). 행 수가 바뀌어도 패널 높이는 이 값으로 고정된다 */
const LIST_HEIGHT = 264;
/** 정렬 헤더 행 높이(px). styles.css 의 .wl-head 와 같은 값. 슬롯은 이만큼 더 커져야 마지막 행이 잘리지 않는다 */
const HEAD_HEIGHT = 28;
/** 헤더에 표시하는 현재 정렬 방향 */
const DIRECTION_MARK: Record<SortDirection, string> = { desc: '▼', asc: '▲' };

interface WatchlistProps {
  items: WatchItem[];
  quotes: QuoteMap;
  selected: string;
  onSelect: (symbol: string) => void;
}

/** 등락률 순으로 늘어놓은 목록. 시세가 없는 종목은 정렬에서 빼고 맨 아래에 원래 순서로 둔다 */
function orderItems(items: WatchItem[], quotes: QuoteMap, direction: SortDirection | null): WatchItem[] {
  if (!direction) return items;
  const rated = items.flatMap((item) => {
    const q = quotes[item.symbol];
    return q ? [{ item, changeRate: q.changeRate }] : [];
  });
  const unrated = items.filter((item) => !quotes[item.symbol]);
  return [...sortByChange(rated, direction).map((r) => r.item), ...unrated];
}

/** 관심종목. 행을 누르면 호가·차트·주문 폼이 그 종목으로 바뀐다. "등락률" 헤더를 누르면 등락률 순으로 정렬한다. */
export function Watchlist({ items, quotes, selected, onSelect }: WatchlistProps) {
  const [showAll, setShowAll] = useState(true);
  const [direction, setDirection] = useState<SortDirection | null>(() => readSortState());
  const ordered = orderItems(items, quotes, direction);
  const visible = showAll ? ordered : ordered.slice(0, COMPACT_THRESHOLD);
  const compact = visible.length > COMPACT_THRESHOLD;

  const handleSortClick = () => {
    const next = toggleDirection(direction);
    writeSortState(next);
    setDirection(next);
  };

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
      <div className="watchlist-body" style={{ height: HEAD_HEIGHT + LIST_HEIGHT }}>
        <div className="wl-head">
          <span className="wl-head-name">종목</span>
          <button
            type="button"
            className={`wl-head-sort${direction ? ' is-on' : ''}`}
            title="등락률 순으로 정렬. 다시 누르면 반대 방향"
            onClick={handleSortClick}
          >
            등락률{direction ? ` ${DIRECTION_MARK[direction]}` : ''}
          </button>
        </div>
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
