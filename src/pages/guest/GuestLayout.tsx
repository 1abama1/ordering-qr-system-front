import { useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { QrProvider } from '../../features/qr-session/Provider';
import { useQr } from '../../features/qr-session/context';
import { RealtimeProvider } from '../../features/realtime/Provider';
import { useCart } from '../../features/cart/store';
import { GuestHeader } from '../../widgets/guest-header/GuestHeader';
function BoundContent() {
  const { session } = useQr();
  const bindTable = useCart((s) => s.bindTable);
  useEffect(() => {
    if (session) bindTable(session.tableNumber);
  }, [session, bindTable]);
  return (
    <>
      <GuestHeader />
      <main className="guest-main">
        <Outlet />
      </main>
      <footer className="guest-footer">
        <span>Приготовлено с заботой. Подано с теплом.</span>
        <span>Цены указаны в кыргызских сомах</span>
      </footer>
    </>
  );
}
export default function GuestLayout() {
  return (
    <QrProvider>
      <RealtimeProvider>
        <div className="guest-shell">
          <BoundContent />
        </div>
      </RealtimeProvider>
    </QrProvider>
  );
}
