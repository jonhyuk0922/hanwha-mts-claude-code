/** 호가 한 단계 (가격·잔량) */
export interface Level {
  price: number;
  qty: number;
}

/** 종목 시세 스냅샷. 화면 계층은 이 객체만 본다. */
export interface Quote {
  symbol: string;
  name: string;
  price: number;
  prevClose: number;
  change: number;
  changeRate: number;
  /** 시세 생성 시각 (epoch ms) */
  ts: number;
  asks: Level[];
  bids: Level[];
}

/** 시세 서버가 밀어주는 증분 데이터 */
export interface QuoteTick {
  symbol: string;
  price: number;
  ts: number;
  asks?: Level[];
  bids?: Level[];
}

export interface WatchItem {
  symbol: string;
  name: string;
  addedAt: string;
}

export type OrderSide = 'buy' | 'sell';
export type OrderStatus = 'open' | 'filled' | 'cancelled';

export interface Order {
  id: string;
  symbol: string;
  name: string;
  side: OrderSide;
  price: number;
  qty: number;
  filledQty: number;
  status: OrderStatus;
  placedAt: string;
}

export interface Candle {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export type Direction = 'up' | 'down' | 'flat';
