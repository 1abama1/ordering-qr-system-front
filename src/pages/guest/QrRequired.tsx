import { QrCode, ScanLine } from 'lucide-react';
import { useQr } from '../../features/qr-session/context';
import { ErrorState, Loading } from '../../shared/components/feedback/Feedback';
export function QrRequired() {
  const { checking, error, retry } = useQr();
  if (checking) return <Loading label="Проверяем ваш столик…" />;
  return (
    <section className="qr-welcome">
      <span className="eyebrow">ДОБРО ПОЖАЛОВАТЬ К СТОЛУ</span>
      <h1>
        Хорошая еда.
        <br />
        <em>В хорошей компании.</em>
      </h1>
      <p>
        Отсканируйте QR-код на вашем столике.
        <br />
        Меню откроется, а заказ отправится прямо на кухню.
      </p>
      <div className="qr-illustration">
        <ScanLine size={130} strokeWidth={0.8} />
        <QrCode size={66} strokeWidth={1.2} />
      </div>
      {error ? (
        <ErrorState error={error} retry={retry} />
      ) : (
        <div className="notice">
          <QrCode size={20} />
          Наведите камеру телефона на QR-код
        </div>
      )}
      <div className="steps">
        <div>
          <b>01</b>
          <span>Сканируйте код</span>
        </div>
        <div>
          <b>02</b>
          <span>Выбирайте любимое</span>
        </div>
        <div>
          <b>03</b>
          <span>Мы приготовим</span>
        </div>
      </div>
    </section>
  );
}
