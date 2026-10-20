import { cloneElement, isValidElement, useId, type ReactNode } from 'react';
export function Field({
  label,
  error,
  children,
  hint,
}: {
  label: string;
  error?: string;
  children: ReactNode;
  hint?: string;
}) {
  const generatedId = useId();
  const control = isValidElement<Record<string, unknown>>(children)
    ? children
    : null;
  const id =
    typeof control?.props.id === 'string' ? control.props.id : generatedId;
  const description =
    [error ? id + '-error' : '', hint ? id + '-hint' : '']
      .filter(Boolean)
      .join(' ') || undefined;
  return (
    <label className="form-field" htmlFor={id}>
      <span id={id + '-label'}>{label}</span>
      {control
        ? cloneElement(control, {
            id,
            'aria-labelledby': id + '-label',
            'aria-describedby': description,
            'aria-invalid': !!error,
          })
        : children}
      {error && (
        <span id={id + '-error'} className="field-error">
          {error}
        </span>
      )}
      {hint && (
        <small id={id + '-hint'} className="muted">
          {hint}
        </small>
      )}
    </label>
  );
}
