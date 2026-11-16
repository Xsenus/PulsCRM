/*
 * Сервис-воркер чата Puls Next: показывает системные уведомления о новых сообщениях (Web Push),
 * даже когда вкладка CRM закрыта (браузер при этом должен быть запущен).
 * Содержимое уведомления сервер шифрует ключом этого браузера; здесь оно уже расшифровано браузером.
 */

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data ? event.data.text() : '' };
  }

  event.waitUntil((async () => {
    // Если CRM открыта и на экране — уведомление и звук покажет сама страница.
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    if (windows.some((client) => client.visibilityState === 'visible' && client.focused)) {
      return;
    }

    const conversationId = Number(data.conversationId) || 0;
    await self.registration.showNotification(data.title || 'Новое сообщение', {
      body: data.body || '',
      // Одно уведомление на диалог: новое сообщение заменяет предыдущее.
      tag: conversationId ? `puls-chat-${conversationId}` : 'puls-chat',
      renotify: true,
      data: { url: data.url || '/chat', conversationId }
    });
  })());
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const { url, conversationId } = event.notification.data || {};

  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const client = windows.find((item) => new URL(item.url).origin === self.location.origin);
    if (client) {
      // Открытая вкладка CRM сама откроет диалог (в окне чата или в разделе «Чат»).
      await client.focus();
      client.postMessage({ type: 'puls-chat-open', conversationId });
      return;
    }

    await self.clients.openWindow(url || '/chat');
  })());
});
