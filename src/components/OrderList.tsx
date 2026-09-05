import type { Order, OrderStatus } from '../types';
import { formatPrice, formatQty, timeOf } from '../lib/format';
import { Panel } from './Panel';

const STATUS_LABEL: Record<OrderStatus, string> = {
  open: '미체결',
  filled: '체결',
  cancelled: '취소',
};

interface OrderListProps {
  orders: Order[];
}

/** 오늘 낸 주문. 최신이 위. */
export function OrderList({ orders }: OrderListProps) {
  const rows = [...orders].reverse();
  return (
    <Panel title="주문 내역" className="orders">
      <table className="orders-table">
        <thead>
          <tr>
            <th>시각</th>
            <th>종목</th>
            <th>구분</th>
            <th className="ta-r">가격</th>
            <th className="ta-r">수량</th>
            <th>상태</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((o) => (
            <tr key={o.id} className={`status-${o.status}`}>
              <td className="muted">{timeOf(o.placedAt)}</td>
              <td>{o.name}</td>
              <td className={o.side === 'buy' ? 'up' : 'down'}>{o.side === 'buy' ? '매수' : '매도'}</td>
              <td className="ta-r num">{formatPrice(o.price)}</td>
              <td className="ta-r num">
                {o.status === 'open' && o.filledQty > 0 ? `${formatQty(o.filledQty)}/` : ''}
                {formatQty(o.qty)}
              </td>
              <td>{STATUS_LABEL[o.status]}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Panel>
  );
}
