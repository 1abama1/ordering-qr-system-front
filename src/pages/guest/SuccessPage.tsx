import { Link } from 'react-router-dom';
import { ArrowRight, Check } from 'lucide-react';
import { orderSchema } from '../../shared/api/contracts';
import { readStorage } from '../../shared/lib/storage';
import { money } from '../../shared/lib/money';
import { Empty } from '../../shared/components/feedback/Feedback';
export default function SuccessPage() {
  const parsed = orderSchema.safeParse(readStorage('restaurant.confirmed.v1'));
  if (!parsed.success)
    return (
      <Empty
        title="Подтверждённого заказа пока нет"
        text="Откройте меню через QR-код на столике."
      />
    );
  const order = parsed.data;
  return (
    <section className="success-page">
      <div className="success-check">
        <Check size={36} />
      </div>
      <span className="eyebrow">СПАСИБО ЗА ВАШ ВЫБОР</span>
      <h1>
        Заказ принят<em>Приятного ожидания!</em>
      </h1>
      <p>Ваш заказ отправлен в ресторан.</p>
      <div className="receipt">
        <div className="receipt-head">
          <span>
            Заказ <b>#{order.id}</b>
          </span>
          <span>
            Столик <b>{order.tableNumber}</b>
          </span>
        </div>
        {order.items.map((i) => (
          <div className="summary-row" key={i.menuItemId}>
            <span>
              {i.quantity} × {i.menuItemName}
            </span>
            <b>{money(i.lineTotal)}</b>
          </div>
        ))}
        <div className="summary-row total">
          <span>Подтверждённая сумма</span>
          <b>{money(order.totalAmount)}</b>
        </div>
      </div>
      <Link className="button button-primary" to="/menu">
        Вернуться в меню <ArrowRight size={18} />
      </Link>
    </section>
  );
}
