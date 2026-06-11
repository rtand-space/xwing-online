// Web-push service worker: show "your turn" notifications and focus the app on click.
self.addEventListener('push', (event) => {
  let data = { title: 'X-Wing Online', body: 'Your turn!' };
  try {
    data = event.data.json();
  } catch {
    /* keep default */
  }
  event.waitUntil(
    self.registration.showNotification(data.title || 'X-Wing Online', {
      body: data.body || 'Your turn!',
      badge: undefined,
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((wins) => {
      for (const w of wins) if ('focus' in w) return w.focus();
      return self.clients.openWindow('/');
    }),
  );
});
