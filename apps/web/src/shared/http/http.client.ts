import type { AuthSession } from '@/shared/auth/model/auth';
import { useAuthStore } from '@/shared/auth/store/auth.store';

type BaseResponse<T> = {
  code: number;
  data: T;
  message: string;
};

type RequestOptions = RequestInit & {
  skipAuth?: boolean;
  skipRefreshRetry?: boolean;
};

let refreshPromise: Promise<AuthSession> | null = null;

export class ApiError extends Error {
  code: number;
  status: number;

  constructor(code: number, message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
  }
}

export async function httpRequest<T>(input: string, options: RequestOptions = {}): Promise<T> {
  return requestWithRetry<T>(input, options, false);
}

export async function httpBlobRequest(input: string, options: RequestOptions = {}): Promise<Blob> {
  return rawRequestWithRetry(input, options, false);
}

async function requestWithRetry<T>(
  input: string,
  options: RequestOptions,
  hasRetried: boolean,
): Promise<T> {
  try {
    return await sendRequest<T>(input, options);
  } catch (error) {
    if (hasRetried || options.skipRefreshRetry || !shouldRefresh(error)) {
      throw error;
    }

    try {
      const session = await refreshSession();
      useAuthStore.getState().setSession(session);
      return requestWithRetry<T>(input, options, true);
    } catch (refreshError) {
      if (isSessionInvalidError(refreshError)) {
        useAuthStore.getState().clearSession();
      }
      throw refreshError;
    }
  }
}

async function sendRequest<T>(input: string, options: RequestOptions): Promise<T> {

  const response = await sendRawRequest(input, options);
  const envelope = await parseEnvelope<T>(response);

  if (!response.ok || envelope.code !== 0) {
    throw new ApiError(envelope.code, envelope.message, response.status);
  }

  return envelope.data;
}

async function rawRequestWithRetry(input: string, options: RequestOptions, hasRetried: boolean): Promise<Blob> {
  try {
    const response = await sendRawRequest(input, options);
    if (!response.ok) {
      const envelope = await parseEnvelope<null>(response);
      throw new ApiError(envelope.code, envelope.message, response.status);
    }
    return response.blob();
  } catch (error) {
    if (hasRetried || options.skipRefreshRetry || !shouldRefresh(error)) throw error;
    const session = await refreshSession();
    useAuthStore.getState().setSession(session);
    return rawRequestWithRetry(input, options, true);
  }
}

async function sendRawRequest(input: string, options: RequestOptions) {
  const { headers, skipAuth } = options;
  const init = { ...options } as RequestInit;
  delete (init as RequestOptions).skipAuth;
  delete (init as RequestOptions).skipRefreshRetry;
  delete init.headers;
  const requestHeaders: Record<string, string> = {};
  if (headers instanceof Headers) {
    headers.forEach((value, key) => {
      requestHeaders[key] = value;
    });
  } else if (Array.isArray(headers)) {
    for (const [key, value] of headers) {
      requestHeaders[key] = value;
    }
  } else if (headers) {
    Object.assign(requestHeaders, headers);
  }
  const accessToken = useAuthStore.getState().accessToken;

  if (!skipAuth && accessToken && !hasHeader(requestHeaders, 'Authorization')) {
    requestHeaders.Authorization = `Bearer ${accessToken}`;
  }

  const response = await fetch(input, {
    ...init,
    headers: requestHeaders,
  });
  return response;
}

function hasHeader(headers: Record<string, string>, name: string) {
  return Object.keys(headers).some((key) => key.toLowerCase() === name.toLowerCase());
}

async function parseEnvelope<T>(response: Response): Promise<BaseResponse<T>> {
  const text = await response.text();
  if (!text) {
    return { code: 0, message: '', data: undefined as T };
  }
  return JSON.parse(text) as BaseResponse<T>;
}

function shouldRefresh(error: unknown) {
  return error instanceof ApiError && [100003, 101003, 101004].includes(error.code);
}

export function isSessionInvalidError(error: unknown) {
  return error instanceof ApiError && error.status === 401;
}

export function refreshSession() {
  if (!refreshPromise) {
    refreshPromise = performRefresh().finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}

async function performRefresh() {
  const response = await fetch('/api/auth/refresh', {
    credentials: 'include',
    method: 'POST',
  });
  const envelope = await parseEnvelope<AuthSession>(response);
  if (!response.ok || envelope.code !== 0) {
    throw new ApiError(envelope.code, envelope.message, response.status);
  }
  return envelope.data;
}
