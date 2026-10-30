'use client';

import { Eye, EyeOff } from 'lucide-react';
import { forwardRef, useState, type InputHTMLAttributes } from 'react';
import { useApp } from '@/components/providers/app-provider';
import { Input } from './input';

/** Password field with a show/hide toggle (the toggle is a real button, reachable by keyboard). */
export const PasswordInput = forwardRef<HTMLInputElement, Omit<InputHTMLAttributes<HTMLInputElement>, 'type'>>(({ className, ...props }, ref) => {
  const { tx } = useApp();
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <Input ref={ref} type={show ? 'text' : 'password'} className={`pe-12 ${className ?? ''}`} {...props} />
      <button type="button" onClick={() => setShow((v) => !v)} aria-pressed={show} aria-label={show ? tx('Hide password', 'إخفاء كلمة المرور') : tx('Show password', 'إظهار كلمة المرور')}
        className="absolute end-1.5 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-full text-muted-foreground hover:bg-surface hover:text-foreground">
        {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
      </button>
    </div>
  );
});
PasswordInput.displayName = 'PasswordInput';
