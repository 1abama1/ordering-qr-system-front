import * as S from '@radix-ui/react-switch';
export function Switch({
  checked,
  disabled,
  onCheckedChange,
  label,
}: {
  checked: boolean;
  disabled?: boolean;
  onCheckedChange: (checked: boolean) => void;
  label: string;
}) {
  return (
    <S.Root
      className="switch"
      checked={checked}
      disabled={disabled}
      onCheckedChange={onCheckedChange}
      aria-label={label}
    >
      <S.Thumb className="switch-thumb" />
    </S.Root>
  );
}
