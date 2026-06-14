const DEFAULT_API_ERROR_MESSAGE = 'Неизвестная ошибка';
const NETWORK_ERROR_MESSAGE = 'API недоступен. Проверьте адрес сервера, CORS и подключение к сети.';
const TIMEOUT_ERROR_MESSAGE = 'API не ответил вовремя. Повторите запрос или проверьте сервер.';

function readString(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

export function getApiErrorMessage(error: unknown, fallback = DEFAULT_API_ERROR_MESSAGE) {
  const apiError = error as {
    code?: string;
    message?: string;
    response?: {
      data?: {
        message?: unknown;
      };
    };
  } | null | undefined;

  const message = readString(apiError?.message) || readString(error);

  if (!apiError?.response && (apiError?.code === 'ERR_NETWORK' || message === 'Network Error' || message === 'Failed to fetch')) {
    return NETWORK_ERROR_MESSAGE;
  }

  if (!apiError?.response && apiError?.code === 'ECONNABORTED') {
    return TIMEOUT_ERROR_MESSAGE;
  }

  const responseMessage = readString(apiError?.response?.data?.message);
  if (responseMessage) {
    return responseMessage;
  }

  return message || fallback;
}

export function throwApiError(error: unknown): never {
  throw new Error(getApiErrorMessage(error));
}
