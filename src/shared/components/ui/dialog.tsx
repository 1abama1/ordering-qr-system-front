import * as D from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import type { ReactNode } from 'react';
export function Dialog({
  open,
  onOpenChange,
  title,
  description,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <D.Root open={open} onOpenChange={onOpenChange}>
      <D.Portal>
        <D.Overlay className="dialog-overlay" />
        <D.Content className="dialog-content">
          <div className="dialog-heading">
            <D.Title>{title}</D.Title>
            <D.Close
              className="button button-ghost button-icon"
              aria-label="Закрыть"
            >
              <X size={20} />
            </D.Close>
          </div>
          <D.Description className={description ? 'muted' : 'sr-only'}>
            {description || title}
          </D.Description>
          {children}
        </D.Content>
      </D.Portal>
    </D.Root>
  );
}
