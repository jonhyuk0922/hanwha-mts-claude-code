import { useState } from 'react';
import type { Candle, Order, Quote, WatchItem } from './types';
import { useQuoteFeed } from './hooks/useQuoteFeed';
import { Watchlist } from './screens/Watchlist';
import { OrderBook } from './screens/OrderBook';
import { OrderForm } from './screens/OrderForm';
import { Chart } from './screens/chart/Chart';
import { OrderList } from './components/OrderList';
import quotesData from './data/quotes.json';
import watchlistData from './data/watchlist.json';
import ordersData from './data/orders.json';
import candlesData from './data/candles.json';

const initialQuotes = quotesData as Quote[];
const watchlist = watchlistData as WatchItem[];
const candlesBySymbol = candlesData as Record<string, Candle[]>;
const DEFAULT_SYMBOL = watchlist[0]?.symbol ?? initialQuotes[0].symbol;

export default function App() {
  const [live, setLive] = useState(true);
  const [selected, setSelected] = useState(DEFAULT_SYMBOL);
  const [orderPrice, setOrderPrice] = useState(() => String(initialQuotes.find((q) => q.symbol === DEFAULT_SYMBOL)?.price ?? ''));
  const [orders, setOrders] = useState<Order[]>(ordersData as Order[]);
  const quotes = useQuoteFeed(initialQuotes, live);
  const quote = quotes[selected] ?? initialQuotes[0];

  const selectSymbol = (symbol: string) => {
    setSelected(symbol);
    setOrderPrice(String(quotes[symbol]?.price ?? ''));
  };

  const placeOrder = (draft: Omit<Order, 'id' | 'placedAt' | 'status' | 'filledQty'>) => {
    const seq = String(orders.length + 1).padStart(4, '0');
    const order: Order = {
      ...draft,
      id: `ORD-20260922-${seq}`,
      filledQty: 0,
      status: 'open',
      placedAt: new Date().toISOString(),
    };
    setOrders((prev) => [...prev, order]);
  };

  return (
    <div className="app">
      <header className="topbar">
        <h1 className="brand">
          모의 MTS <span className="muted">교육용 샘플 · 실제 시세 아님</span>
        </h1>
        <button type="button" className={`live-toggle${live ? ' is-on' : ''}`} onClick={() => setLive((v) => !v)}>
          {live ? '실시간 켜짐' : '실시간 멈춤'}
        </button>
      </header>

      <main className="layout">
        <aside className="col col-left">
          <Watchlist items={watchlist} quotes={quotes} selected={selected} onSelect={selectSymbol} />
        </aside>

        <section className="col col-center">
          <Chart candles={candlesBySymbol[selected] ?? []} quote={quote} />
          {/* 호가창은 자체 피드를 돌린다. 종목이 바뀌면 key 로 갈아 끼워야 잔량이 섞이지 않는다 */}
          <OrderBook key={selected} quote={quote} live={live} onPickPrice={(p) => setOrderPrice(String(p))} />
        </section>

        <aside className="col col-right">
          <OrderForm key={selected} quote={quote} price={orderPrice} onPriceChange={setOrderPrice} onSubmit={placeOrder} />
          <OrderList orders={orders} />
        </aside>
      </main>
    </div>
  );
}
