/** The signed-in account (live product): who I am, first-time setup, parent links, my data. */
import type { Account } from '@/components/providers/app-provider';
import { request } from './http';

export const getAccount = () => request<Account>('/account', { timeoutMs: 10_000 });
export const setupAccount = (body: { role: 'student'; name: string; grade: number; joinCode?: string } | { role: 'parent'; name: string; childCode?: string }) =>
  request<Account>('/account/setup', { method: 'POST', body, timeoutMs: 12_000 });
export const makeParentCode = () => request<{ code: string }>('/account/parent-code', { method: 'POST' });
export const linkChild = (code: string) => request<Account>('/account/link-child', { method: 'POST', body: { code } });
export const exportMyData = () => request<unknown>('/account/export', { timeoutMs: 20_000 });
export const deleteMyAccount = () => request<{ ok: boolean }>('/account', { method: 'DELETE' });
export const joinClass = (code: string) => request<{ name: string }>('/student/classes/join', { method: 'POST', body: { code } });
