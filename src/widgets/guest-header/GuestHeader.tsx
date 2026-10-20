import { Link } from 'react-router-dom';
import { ArrowUpRight, ShoppingBag, UtensilsCrossed } from 'lucide-react';
import { useQr } from '../../features/qr-session/context';
import { useCart } from '../../features/cart/store';
import { env } from '../../shared/config/env';
import { Connection } from '../../shared/components/feedback/Connection';
export function GuestHeader() {
  const { session } = useQr();
  const lines = useCart((s) => s.lines);
  const count = lines.reduce((sum, l) => sum + l.quantity, 0);
  return (
    <header className="guest-header">
      <Link className="brand" to="/">
        <span className="brand-mark">
          <UtensilsCrossed size={22} />
        </span>
        <span>
          {env.restaurant}
          <small>кухня, которая объединяет</small>
        </span>
      </Link>
      <div className="header-actions">
        <Connection />
        {session && (
          <span className="table-badge">
            <span className="status-dot" />
            Столик {session.tableNumber}
          </span>
        )}
        <Link className="staff-link" to="/staff/login">
          Для команды <ArrowUpRight size={14} />
        </Link>
        <Link
          className="cart-icon"
          to="/cart"
          aria-label={`Корзина, ${count} блюд`}
        >
          <ShoppingBag size={21} />
          {count > 0 && <span>{count}</span>}
        </Link>
      </div>
    </header>
  );
}
