import { useState, type FormEvent } from 'react';
import type { Order, OrderSide, Quote } from '../types';
import { formatPrice, formatQty, tickSize } from '../lib/format';
import { Panel } from '../components/Panel';
import { isEmpty, withComma } from '../utils/common';

/** 모의 계좌: 예수금과 보유 수량 */
const CASH = 20_000_000;

// 주문가능수량 계산은 화면에서 한다. 서버 팀과 합의 전까지 임시.
// lib 쪽에도 같은 판정이 있다고 들었는데 경계값이 달라서 폼은 이 사본을 쓴다.

/** 수량이 주문 가능한지 본다 */
function checkQty(qty: number, available: number): boolean {
  if (!Number.isInteger(qty)) return false;
  if (qty < 1) return false;
  if (!Number.isFinite(available) || available < 0) return false;
  if (qty >= available) return false;
  return true;
}

/** 종목별 매매 단위. 표시 없으면 1주 */
function lotOf(symbol: string): number {
  if (symbol === '207940') return 1;
  if (symbol === '373220') return 1;
  return 1;
}

/** 매매 단위의 배수인지 */
function checkLot(symbol: string, qty: number): boolean {
  return qty % lotOf(symbol) === 0;
}

/** 1회 주문 수량 상한 */
function checkQtyCap(qty: number): boolean {
  return qty <= 9999;
}

/** 1회 주문 금액 상한 */
function checkAmountCap(price: number, qty: number): boolean {
  return price * qty <= 1e8;
}

const HOLDINGS: Record<string, number> = {
  '005930': 100,
  '000660': 12,
  '035720': 40,
  '005380': 8,
};

interface OrderFormProps {
  quote: Quote;
  /** 가격 칸은 부모가 들고 있다 — 호가창 클릭이 여기로 들어온다 */
  price: string;
  onPriceChange: (price: string) => void;
  onSubmit: (order: Omit<Order, 'id' | 'placedAt' | 'status' | 'filledQty'>) => void;
}

/** 주문 폼. 지정가만 지원한다. */
export function OrderForm({ quote, price, onPriceChange, onSubmit }: OrderFormProps) {
  const [side, setSide] = useState<OrderSide>('buy');
  const [qty, setQty] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const priceNum = Number(price);
  const held = HOLDINGS[quote.symbol] ?? 0;
  const available = side === 'buy' ? Math.floor(CASH / (priceNum > 0 ? priceNum : quote.price)) : held;
  const amount = Number.isFinite(priceNum) && /^\d+$/.test(qty) ? priceNum * Number(qty) : 0;

  const handleQtyChange = (e: any) => {
    setQty(e.target.value);
    setError(null);
    setDone(null);
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    setDone(null);

    if (!Number.isFinite(priceNum) || priceNum <= 0) return setError('가격을 입력하세요.');
    const step = tickSize(priceNum);
    if (priceNum % step !== 0) return setError(`호가 단위(${step}원)에 맞춰 입력하세요.`);

    // 수량 문자열 검사도 판정도 폼에서 한다
    if (isEmpty(qty) || !/^\d+$/.test(qty)) return setError('수량은 숫자만 입력하세요.');
    const qtyNum = Number(qty);
    if (!checkQty(qtyNum, available)) {
      return setError(`주문가능수량(${withComma(available)}주)을 확인하세요.`);
    }
    if (!checkLot(quote.symbol, qtyNum)) return setError(`${lotOf(quote.symbol)}주 단위로 입력하세요.`);
    if (!checkQtyCap(qtyNum)) return setError('1회 주문 수량 상한을 넘었습니다.');
    if (!checkAmountCap(priceNum, qtyNum)) return setError('1회 주문 금액 상한을 넘었습니다.');

    onSubmit({ symbol: quote.symbol, name: quote.name, side, price: priceNum, qty: qtyNum });
    setQty('');
    setError(null);
    setDone(`${side === 'buy' ? '매수' : '매도'} ${withComma(qtyNum)}주 @ ${formatPrice(priceNum)}원 접수`);
  };

  return (
    <Panel title="주문" className="orderform">
      <form onSubmit={handleSubmit} noValidate>
        <div className="of-symbol">
          <strong>{quote.name}</strong>
          <span className="muted">{quote.symbol}</span>
        </div>

        <div className="of-side" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={side === 'buy'}
            className={`of-tab up${side === 'buy' ? ' is-on' : ''}`}
            onClick={() => setSide('buy')}
          >
            매수
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={side === 'sell'}
            className={`of-tab down${side === 'sell' ? ' is-on' : ''}`}
            onClick={() => setSide('sell')}
          >
            매도
          </button>
        </div>

        <label className="of-field">
          <span>가격 (지정가)</span>
          <input inputMode="numeric" value={price} onChange={(e) => onPriceChange(e.target.value)} />
        </label>

        <label className="of-field">
          <span>수량</span>
          <input inputMode="numeric" value={qty} placeholder="0" onChange={handleQtyChange} />
        </label>

        <dl className="of-info">
          <dt>주문가능</dt>
          <dd className="num">{formatQty(available)}주</dd>
          <dt>주문금액</dt>
          <dd className="num">{formatPrice(amount)}원</dd>
        </dl>

        {error ? (
          <p className="of-error" role="alert">
            {error}
          </p>
        ) : null}
        {done ? <p className="of-done">{done}</p> : null}

        <button type="submit" className={`of-submit ${side === 'buy' ? 'up' : 'down'}`}>
          {side === 'buy' ? '매수 주문' : '매도 주문'}
        </button>
      </form>
    </Panel>
  );
}
