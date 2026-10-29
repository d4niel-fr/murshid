'use client';

import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { Slot } from 'radix-ui';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

export const buttonVariants = cva(
  'group/btn inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-full pointer-coarse:min-h-11 text-sm font-medium tracking-[-0.005em] transition-[background-color,color,border-color,transform] duration-200 active:scale-[0.97] disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-light)] focus-visible:ring-offset-2 focus-visible:ring-offset-background',
  {
    variants: {
      variant: {
        primary: 'bg-foreground text-background hover:bg-[var(--deep)] dark:hover:bg-white',
        ink: 'bg-foreground text-background hover:bg-[var(--deep)] dark:hover:bg-white',
        accent: 'bg-primary text-primary-foreground hover:bg-[var(--deep)]',
        secondary: 'bg-surface text-foreground hover:bg-[color-mix(in_oklab,var(--surface)_80%,var(--text)_7%)]',
        outline: 'border border-border bg-transparent text-foreground hover:border-foreground',
        ghost: 'text-foreground hover:bg-surface',
        light: 'bg-white text-[var(--deep)] hover:bg-[var(--brand-light)] hover:text-white',
        glass: 'border border-white/15 bg-white/10 text-white backdrop-blur hover:bg-white/20',
        danger: 'bg-danger text-white hover:brightness-110',
        link: 'text-primary underline-offset-4 hover:underline px-0',
      },
      size: {
        sm: 'h-8 px-3.5 text-[13px]',
        md: 'h-10 px-5',
        lg: 'h-12 px-6 text-[15px]',
        icon: 'size-10',
        'icon-sm': 'size-8',
      },
    },
    defaultVariants: { variant: 'primary', size: 'md' },
  },
);

/** The trailing arrow that nudges when its button is hovered. */
export function Arrow({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden className={`nudge size-4 ${className}`}>
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(({ className, variant, size, asChild, type, ...props }, ref) => {
  const Comp = asChild ? Slot.Root : 'button';
  return <Comp ref={ref} type={asChild ? undefined : (type ?? 'button')} className={cn(buttonVariants({ variant, size }), className)} {...props} />;
});
Button.displayName = 'Button';
