import { describe, expect, it } from 'vitest';
import { getApiErrorMessage } from './apiErrors';

describe('getApiErrorMessage', () => {
  it('converts axios network errors to a user-facing API availability message', () => {
    expect(getApiErrorMessage({ code: 'ERR_NETWORK', message: 'Network Error' })).toBe(
      'API недоступен. Проверьте адрес сервера, CORS и подключение к сети.'
    );
  });

  it('converts request timeouts to a retryable timeout message', () => {
    expect(getApiErrorMessage({ code: 'ECONNABORTED', message: 'timeout of 30000ms exceeded' })).toBe(
      'API не ответил вовремя. Повторите запрос или проверьте сервер.'
    );
  });

  it('prefers backend response messages over transport messages', () => {
    expect(getApiErrorMessage({
      message: 'Request failed with status code 401',
      response: {
        data: {
          message: 'Неверный логин или пароль.'
        }
      }
    })).toBe('Неверный логин или пароль.');
  });

  it('uses fallback when error does not contain a readable message', () => {
    expect(getApiErrorMessage({}, 'Не удалось войти.')).toBe('Не удалось войти.');
  });

  it('uses string errors as readable messages', () => {
    expect(getApiErrorMessage('Не удалось сохранить запись.')).toBe('Не удалось сохранить запись.');
  });
});
