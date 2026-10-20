import { Wifi, WifiOff } from 'lucide-react';
import { useRealtime } from '../../../features/realtime/context';
export function Connection() {
  const { state, retry } = useRealtime();
  const live = state === 'live';
  return (
    <button
      className={`connection ${live ? 'is-live' : ''}`}
      onClick={retry}
      title="Нажмите, чтобы переподключиться"
      aria-label={`Подключение: ${state === 'live' ? 'онлайн' : 'синхронизация по REST, переподключиться'}`}
    >
      {live ? <Wifi size={14} /> : <WifiOff size={14} />}
      <span>
        {live
          ? 'Онлайн'
          : state === 'connecting'
            ? 'Подключаемся'
            : state === 'offline'
              ? 'Нет сети'
              : 'Обновление каждые 15 с'}
      </span>
    </button>
  );
}
