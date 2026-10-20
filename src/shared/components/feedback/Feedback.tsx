import { AlertCircle, LoaderCircle, RefreshCw } from 'lucide-react';
import { errorMessage, normalizeError } from '../../api/errors';
import { Button } from '../ui/button';
export function Loading({ label = 'Загружаем…' }: { label?: string }) {
  return (
    <div className="state" role="status">
      <LoaderCircle className="spin" size={28} />
      <p>{label}</p>
    </div>
  );
}
export function ErrorState({
  error,
  retry,
  compact = false,
}: {
  error: unknown;
  retry?: () => void;
  compact?: boolean;
}) {
  const p = normalizeError(error).problem;
  return (
    <div
      className={compact ? 'notice error-notice' : 'state error-state'}
      role="alert"
    >
      <AlertCircle size={24} />
      <div>
        <p>{errorMessage(error)}</p>
        {p.errors?.map((e) => (
          <p key={e.field} className="small">
            {e.field}: {e.message}
          </p>
        ))}
        {p.correlationId && <small>Код обращения: {p.correlationId}</small>}
      </div>
      {retry && (
        <Button variant="secondary" onClick={retry}>
          <RefreshCw size={16} />
          Повторить
        </Button>
      )}
    </div>
  );
}
export function Empty({ title, text }: { title: string; text: string }) {
  return (
    <div className="state">
      <h3>{title}</h3>
      <p className="muted">{text}</p>
    </div>
  );
}
