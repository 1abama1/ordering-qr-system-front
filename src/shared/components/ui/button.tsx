import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../lib/utils';
const variants = cva('button', {
  variants: {
    variant: {
      default: 'button-primary',
      secondary: 'button-secondary',
      ghost: 'button-ghost',
      danger: 'button-danger',
    },
    size: { default: '', icon: 'button-icon', sm: 'button-sm' },
  },
  defaultVariants: { variant: 'default', size: 'default' },
});
export const Button = forwardRef<
  HTMLButtonElement,
  ButtonHTMLAttributes<HTMLButtonElement> & VariantProps<typeof variants>
>(({ className, variant, size, type = 'button', ...props }, ref) => (
  <button
    ref={ref}
    type={type}
    className={cn(variants({ variant, size }), className)}
    {...props}
  />
));
Button.displayName = 'Button';
