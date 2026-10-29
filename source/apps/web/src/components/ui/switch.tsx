'use client';

import { Switch as S } from 'radix-ui';
import { cn } from '@/lib/utils';

export function Switch({ className, ...props }: React.ComponentProps<typeof S.Root>) {
  return (
    <S.Root
      className={cn('peer inline-flex h-6 w-10 shrink-0 items-center rounded-full border border-transparent bg-[color-mix(in_oklab,var(--text)_14%,transparent)] transition-colors data-[state=checked]:bg-[var(--deep)] data-[state=checked]:ring-transparent', className)}
      {...props}
    >
      <S.Thumb className="pointer-events-none block size-5 rounded-full bg-white shadow-[0_1px_3px_rgb(15_47_99/0.3)] transition-transform duration-200 data-[state=checked]:translate-x-[17px] data-[state=unchecked]:translate-x-[1px] rtl:data-[state=checked]:-translate-x-[17px] rtl:data-[state=unchecked]:-translate-x-[1px]" />
    </S.Root>
  );
}
