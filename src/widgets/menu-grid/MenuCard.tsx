import { useState } from 'react';
import { Minus, Plus, Utensils } from 'lucide-react';
import type { MenuItem } from '../../shared/api/contracts';
import { money } from '../../shared/lib/money';
import { Button } from '../../shared/components/ui/button';
import { Dialog } from '../../shared/components/ui/dialog';
import { useCart } from '../../features/cart/store';
import { getAttempt } from '../../features/checkout/attempt';
export function FoodImage({ item }: { item: MenuItem }) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const safeUrl =
    item.imageUrl && /^https?:\/\//.test(item.imageUrl) ? item.imageUrl : null;
  return safeUrl && failedUrl !== safeUrl ? (
    <img
      className="food-image"
      src={safeUrl}
      alt={item.name}
      loading="lazy"
      decoding="async"
      referrerPolicy="no-referrer"
      onError={() => setFailedUrl(safeUrl)}
    />
  ) : (
    <div
      className={`food-placeholder food-tone-${item.categoryId % 4}`}
      role="img"
      aria-label="Фото блюда пока нет"
    >
      <span className="plate-ring" />
      <Utensils size={46} strokeWidth={1} />
      <span className="placeholder-caption">из нашей кухни</span>
    </div>
  );
}
export function QuantityControl({
  item,
  disabled = false,
}: {
  item: MenuItem;
  disabled?: boolean;
}) {
  const lines = useCart((s) => s.lines),
    change = useCart((s) => s.change);
  const quantity = lines.find((l) => l.menuItemId === item.id)?.quantity ?? 0;
  const locked = disabled || !!getAttempt();
  return quantity ? (
    <div className="quantity">
      <Button
        size="icon"
        variant="ghost"
        aria-label={`Убрать одну порцию ${item.name}`}
        disabled={locked}
        onClick={() => change(item, -1)}
      >
        <Minus size={16} />
      </Button>
      <b aria-live="polite">{quantity}</b>
      <Button
        size="icon"
        variant="ghost"
        aria-label={`Добавить одну порцию ${item.name}`}
        disabled={
          locked || !item.isAvailable || !item.isActive || quantity >= 100
        }
        onClick={() => change(item, 1)}
      >
        <Plus size={16} />
      </Button>
    </div>
  ) : (
    <Button
      className="add-button"
      size="icon"
      aria-label={`Добавить ${item.name}`}
      disabled={
        locked || !item.isAvailable || !item.isActive || lines.length >= 50
      }
      onClick={() => change(item, 1)}
    >
      <Plus size={21} />
    </Button>
  );
}
export function MenuCard({
  item,
  category,
}: {
  item: MenuItem;
  category?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <article
        className={`menu-card ${!item.isAvailable ? 'unavailable' : ''}`}
      >
        <button
          className="food-trigger"
          onClick={() => setOpen(true)}
          aria-label={`Подробнее: ${item.name}`}
        >
          <FoodImage item={item} />
          {!item.isAvailable && <span className="sold-out">Нет в наличии</span>}
        </button>
        <div className="menu-card-body">
          <span className="card-category">{category}</span>
          <button className="name-button" onClick={() => setOpen(true)}>
            <h3>{item.name}</h3>
          </button>
          <p>{item.description || 'Блюдо из нашего меню'}</p>
          <div className="card-bottom">
            <strong>{money(item.price)}</strong>
            <QuantityControl item={item} />
          </div>
        </div>
      </article>
      <Dialog
        open={open}
        onOpenChange={setOpen}
        title={item.name}
        description={item.description || undefined}
      >
        <FoodImage item={item} />
        <div className="dialog-food-bottom">
          <strong>{money(item.price)}</strong>
          {!item.isAvailable && <span className="badge">Нет в наличии</span>}
          <QuantityControl item={item} />
        </div>
      </Dialog>
    </>
  );
}
