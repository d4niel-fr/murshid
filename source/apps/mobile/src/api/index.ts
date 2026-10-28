import type { MurshidApi } from './client';
import { HttpApi } from './http';
import { MockApi } from './mock';

export * from './client';
export * from './types';

const baseUrl = process.env.EXPO_PUBLIC_API_URL?.trim() ?? '';
const forceMock = (process.env.EXPO_PUBLIC_USE_MOCK ?? '').toLowerCase() === 'true';

/** Mock unless an API URL is configured and mock isn't forced. The app therefore runs standalone by default. */
export const api: MurshidApi = baseUrl && !forceMock ? new HttpApi(baseUrl) : new MockApi();

export const isMock = (a: MurshidApi = api): a is MockApi => a.kind === 'mock';
export { MockApi, HttpApi };
