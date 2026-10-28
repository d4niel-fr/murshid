'use client';

import { Switch as S } from 'radix-ui';
import { cn } from '@/lib/utils';

export function Switch({ className, ...props }: React.ComponentProps<typeof S.Root>) {
  return (
    <S.Root
      className={cn('peer inline-flex h-6 w-10 shrink-0 items-center rounded-full border border-transparent bg-surface-2 ring-1 ring-inset ring-border transition-colors data-[state=checked]:bg-primary data-[state=checked]:ring-transparent', className)}
      {...props}
    >
      <S.Thumb className="pointer-events-none block size-5 rounded-full bg-surface shadow-soft transition-transform duration-200 data-[state=checked]:translate-x-[17px] data-[state=unchecked]:translate-x-[1px] rtl:data-[state=checked]:-translate-x-[17px] rtl:data-[state=unchecked]:-translate-x-[1px]" />
    </S.Root>
  );
}
