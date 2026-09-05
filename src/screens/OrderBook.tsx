import type { Level, Quote } from '../types';
import { directionOf, formatChange, formatPrice, formatQty, formatRate } from '../lib/format';
import { Panel } from '../components/Panel';
import { PriceText } from '../components/PriceText';

interface OrderBookProps {
  quote: Quote;
  onPickPrice: (price: number) => void;
}

/** 호가창. 매도 10단계는 위(높은 가격부터), 매수 10단계는 아래. 가격을 누르면 주문 폼에 들어간다. */
export function OrderBook({ quote, onPickPrice }: OrderBookProps) {
  const asks = [...quote.asks].reverse(); // 화면 위쪽이 높은 가격
  const bids = quote.bids;
  const maxQty = Math.max(...quote.asks.map((l) => l.qty), ...quote.bids.map((l) => l.qty));
  const askTotal = sum(quote.asks);
  const bidTotal = sum(quote.bids);
  const dir = directionOf(quote.change);

  return (
    <Panel
      title="호가"
      className="orderbook"
      right={
        <span className="ob-summary">
          <PriceText value={formatPrice(quote.price)} direction={dir} className="ob-last" />
          <PriceText value={`${formatChange(quote.change)} (${formatRate(quote.changeRate)})`} direction={dir} className="ob-diff" />
        </span>
      }
    >
      <div className="ob-grid" role="table" aria-label={`${quote.name} 호가`}>
        <div className="ob-head" role="row">
          <span>매도잔량</span>
          <span>호가</span>
          <span>매수잔량</span>
        </div>

        {asks.map((lv) => (
          <BookRow key={`a${lv.price}`} level={lv} side="ask" maxQty={maxQty} last={quote.price} prevClose={quote.prevClose} onPick={onPickPrice} />
        ))}
        {bids.map((lv) => (
          <BookRow key={`b${lv.price}`} level={lv} side="bid" maxQty={maxQty} last={quote.price} prevClose={quote.prevClose} onPick={onPickPrice} />
        ))}

        <div className="ob-foot" role="row">
          <span className="num">{formatQty(askTotal)}</span>
          <span className="muted">총잔량</span>
          <span className="num">{formatQty(bidTotal)}</span>
        </div>
      </div>
    </Panel>
  );
}

interface BookRowProps {
  level: Level;
  side: 'ask' | 'bid';
  maxQty: number;
  last: number;
  prevClose: number;
  onPick: (price: number) => void;
}

function BookRow({ level, side, maxQty, last, prevClose, onPick }: BookRowProps) {
  const width = `${Math.round((level.qty / maxQty) * 100)}%`;
  const isLast = level.price === last;
  const priceDir = directionOf(level.price - prevClose);

  return (
    <div className={`ob-row ob-${side}${isLast ? ' is-last' : ''}`} role="row">
      <span className="ob-qty ob-qty-ask">
        {side === 'ask' ? (
          <>
            <i className="ob-bar" style={{ width }} />
            <b className="num">{formatQty(level.qty)}</b>
          </>
        ) : null}
      </span>
      <button type="button" className={`ob-price num ${priceDir}`} onClick={() => onPick(level.price)}>
        {formatPrice(level.price)}
      </button>
      <span className="ob-qty ob-qty-bid">
        {side === 'bid' ? (
          <>
            <i className="ob-bar" style={{ width }} />
            <b className="num">{formatQty(level.qty)}</b>
          </>
        ) : null}
      </span>
    </div>
  );
}

function sum(levels: Level[]): number {
  return levels.reduce((acc, l) => acc + l.qty, 0);
}
