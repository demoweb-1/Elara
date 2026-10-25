// Elara service worker: shows LoveLink notifications and opens the app when they are tapped.
self.addEventListener('push', (event) => {
  let data = { title: 'Elara · LoveLink', body: 'A little detail, remembered.', url: '/' }
  try { data = { ...data, ...event.data.json() } } catch { /* keep defaults */ }
  event.waitUntil(self.registration.showNotification(data.title, {
    body: data.body,
    icon: 'icon-192.png',
    badge: 'icon-192.png',
    tag: data.tag || 'lovelink',
    data: { url: data.url },
  }))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const target = new URL(event.notification.data?.url || '/', self.location.origin).href
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if (client.url.startsWith(self.registration.scope)) return client.focus()
      }
      return self.clients.openWindow(target)
    }),
  )
})
