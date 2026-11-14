/**
 * Выполняет асинхронные задачи не больше чем по `limit` одновременно, в порядке добавления.
 * Нужен, чтобы пачка из 10 фото не декодировалась и не отправлялась вся разом:
 * это забивает память и канал, а первые файлы готовы позже.
 */
export function createTaskLimiter(limit: number) {
  let running = 0;
  const waiting: Array<() => void> = [];

  const next = () => {
    if (running >= limit || waiting.length === 0) {
      return;
    }

    running += 1;
    waiting.shift()!();
  };

  return function schedule<T>(task: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      waiting.push(() => {
        task()
          .then(resolve, reject)
          .finally(() => {
            running -= 1;
            next();
          });
      });
      next();
    });
  };
}
