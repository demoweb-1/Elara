// Elara service worker: shows LoveLink notifications and opens the app when they are tapped.
// Design follows Apple's notification guidance: a short title, no repeated app name, one clear tap target,
// a quiet monochrome status-bar badge, and a restrained banner.

const TITLE_PREFIX = /^Elara\s*·\s*/

self.addEventListener('push', (event) => {
  let data = { title: 'LoveLink', body: 'A little detail, remembered.', url: '/' }
  try { data = { ...data, ...event.data.json() } } catch { /* keep defaults */ }
  const title = (data.title || 'LoveLink').replace(TITLE_PREFIX, '')

  event.waitUntil(self.registration.showNotification(title, {
    body: data.body,
    icon: 'icon-192.png',
    badge: 'lovelink-badge.png',
    image: 'lovelink-banner.png',
    tag: data.tag || 'lovelink',
    renotify: true,
    vibrate: [40, 30, 40],
    timestamp: Date.now(),
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
