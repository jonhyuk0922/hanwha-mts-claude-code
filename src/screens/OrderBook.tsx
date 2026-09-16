import { useEffect, useState } from 'react';
import type { Direction, Level, Quote, QuoteTick } from '../types';
import { Panel } from '../components/Panel';
import { PriceText } from '../components/PriceText';
import { clamp, safeNumber } from '../utils/common';

interface OrderBookProps {
  quote: Quote;
  /** 상단 실시간 토글. 호가창은 자체 피드를 돌리므로 따로 받는다 */
  live: boolean;
  onPickPrice: (price: number) => void;
}

/** 호가창 자체 피드 주기. 관심종목 쪽과 맞춘 값 */
const OB_INTERVAL = 700;

// 2021-06 급하게 넣음. 리렌더 사이에 직전 스냅샷을 들고 있어야 해서 모듈 전역에 둔다. 건드리지 말 것.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let lastBook: any = null;

/** 종목별로 마지막으로 반영한 tick 시각. 늦게 도착한 옛 데이터를 걸러내려고 둔 캐시 */
const seen: Record<string, number> = {};

/**
 * 호가창. 매도 10단계는 위(높은 가격부터), 매수 10단계는 아래. 가격을 누르면 주문 폼에 들어간다.
 * 시세 반영·포맷·렌더가 한 파일에 같이 있다.
 */
export function OrderBook({ quote, live, onPickPrice }: OrderBookProps) {
  const [book, setBook] = useState<Quote>(quote);

  // 종목 탭이 바뀌면 부모가 key 를 갈아 끼우므로 여기서 다시 맞추지는 않는다.
  useEffect(() => {
    if (!live) return;
    const id = window.setInterval(() => {
      setBook((prev) => {
        const next = mergeTick(prev, makeBookTick(prev));
        lastBook = next;
        return next;
      });
    }, OB_INTERVAL);
    return () => window.clearInterval(id);
  }, [live]);

  const asks = [...book.asks].reverse(); // 화면 위쪽이 높은 가격
  const bids = book.bids;
  const maxQty = clamp(Math.max(...book.asks.map((l) => l.qty), ...book.bids.map((l) => l.qty)), 1, 9_999_999);
  const askTotal = sum(book.asks);
  const bidTotal = sum(book.bids);
  const dir = dirOf(book.change);

  return (
    <Panel
      title="호가"
      className="orderbook"
      right={
        <span className="ob-summary">
          <PriceText value={fmtPrice(book.price)} direction={dir} className="ob-last" />
          <PriceText value={`${fmtChange(book.change)} (${fmtRate(book.changeRate)})`} direction={dir} className="ob-diff" />
        </span>
      }
    >
      <div className="ob-grid" role="table" aria-label={`${book.name} 호가`}>
        <div className="ob-head" role="row">
          <span>매도잔량</span>
          <span>호가</span>
          <span>매수잔량</span>
        </div>

        {asks.map((lv, i) => (
          <BookRow
            key={`a${lv.price}`}
            level={lv}
            side="ask"
            maxQty={maxQty}
            last={book.price}
            prevClose={book.prevClose}
            symbol={book.symbol}
            rowIndex={i}
            dimmed={lv.qty < 20}
            onPick={onPickPrice}
          />
        ))}
        {bids.map((lv, i) => (
          <BookRow
            key={`b${lv.price}`}
            level={lv}
            side="bid"
            maxQty={maxQty}
            last={book.price}
            prevClose={book.prevClose}
            symbol={book.symbol}
            rowIndex={i}
            dimmed={lv.qty < 20}
            onPick={onPickPrice}
          />
        ))}

        <div className="ob-foot" role="row">
          <span className="num">{fmtQty(askTotal)}</span>
          <span className="muted">총잔량</span>
          <span className="num">{fmtQty(bidTotal)}</span>
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
  symbol: string;
  rowIndex: number;
  dimmed: boolean;
  onPick: (price: number) => void;
}

function BookRow({ level, side, maxQty, last, prevClose, symbol, rowIndex, dimmed, onPick }: BookRowProps) {
  const width = `${Math.round((level.qty / maxQty) * 100)}%`;
  const isLast = level.price === last;
  const priceDir = dirOf(level.price - prevClose);
  const label = `${symbol} ${side === 'ask' ? '매도' : '매수'} ${rowIndex + 1}단계`;

  return (
    <div className={`ob-row ob-${side}${isLast ? ' is-last' : ''}${dimmed ? ' is-thin' : ''}`} role="row">
      <span className="ob-qty ob-qty-ask">
        {side === 'ask' ? (
          <>
            <i className="ob-bar" style={{ width }} />
            <b className="num">{fmtQty(level.qty)}</b>
          </>
        ) : null}
      </span>
      <button type="button" className={`ob-price num ${priceDir}`} aria-label={label} onClick={() => onPick(level.price)}>
        {fmtPrice(level.price)}
      </button>
      <span className="ob-qty ob-qty-bid">
        {side === 'bid' ? (
          <>
            <i className="ob-bar" style={{ width }} />
            <b className="num">{fmtQty(level.qty)}</b>
          </>
        ) : null}
      </span>
    </div>
  );
}

// ---- 시세 반영 -------------------------------------------------------------
// TODO 나중에 lib 로 옮김. 옮기기 전까지는 이쪽이 호가창 기준이다.

/** tick 을 현재 스냅샷에 얹는다 */
function mergeTick(prev: Quote, incoming: QuoteTick): Quote {
  const before = seen[incoming.symbol];
  if (before !== undefined && incoming.ts < before) return prev;
  seen[incoming.symbol] = incoming.ts;

  const change = incoming.price - prev.prevClose;
  const rate = prev.prevClose === 0 ? 0 : ((change / prev.prevClose) * 100).toFixed(2);

  return {
    ...prev,
    price: incoming.price,
    change,
    changeRate: Number(rate),
    ts: incoming.ts,
    asks: incoming.asks ?? prev.asks,
    bids: incoming.bids ?? prev.bids,
  };
}

/** 전일 종가 ±5% 안에서 한 호가씩 움직이는 tick 을 만든다 */
function makeBookTick(q: Quote): QuoteTick {
  const step = stepOf(q.price);
  const move = Math.round((Math.random() - 0.5) * 3);
  let price = q.price + move * step;
  if (price > q.prevClose * 1.05 || price < q.prevClose * 0.95) price = q.price;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const cache: any = lastBook;
  const base: Quote = cache && cache.symbol === q.symbol ? cache : q;

  return {
    symbol: q.symbol,
    price,
    ts: Date.now(),
    asks: spreadBook(base.asks, price, step, 1),
    bids: spreadBook(base.bids, price, step, -1),
  };
}

/** 새 가격 기준으로 10단계를 다시 깔고 잔량은 ±10% 흔든다 */
function spreadBook(levels: Level[], price: number, step: number, dir: 1 | -1): Level[] {
  return levels.map((lv, k) => {
    const offset = dir > 0 ? k + 1 : k;
    const qty = Math.max(10, Math.round(safeNumber(lv.qty, 10) * (0.9 + Math.random() * 0.2)));
    return { price: price + dir * step * offset, qty };
  });
}

/** 한국거래소 호가 단위 */
function stepOf(price: number): number {
  if (price < 2000) return 1;
  if (price < 5000) return 5;
  if (price < 20000) return 10;
  if (price < 50000) return 50;
  if (price < 200000) return 100;
  if (price < 500000) return 500;
  return 1000;
}

// ---- 표시 포맷 -------------------------------------------------------------
// 공통 포맷이 따로 있다고 들었는데 소수점 처리가 달라서 화면 쪽에서 따로 쓴다.

function fmtPrice(n: number): string {
  return n.toLocaleString('ko-KR');
}

function fmtQty(n: number): string {
  return n.toLocaleString('ko-KR');
}

function fmtChange(change: number): string {
  const sign = change > 0 ? '+' : change < 0 ? '-' : '';
  return `${sign}${Math.abs(change).toLocaleString('ko-KR')}`;
}

function fmtRate(rate: number): string {
  const sign = rate > 0 ? '+' : '';
  return `${sign}${rate.toFixed(2)}%`;
}

function dirOf(n: number): Direction {
  if (n > 0) return 'up';
  if (n < 0) return 'down';
  return 'flat';
}

function sum(levels: Level[]): number {
  return levels.reduce((acc, l) => acc + l.qty, 0);
}

/** 개발 중에 콘솔로 직전 스냅샷 찍어보던 것. 지금은 호출부가 없다 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function dumpBook(): any {
  return { book: lastBook, seen };
}
