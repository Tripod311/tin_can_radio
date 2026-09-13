// =======================
// INSTALL / ACTIVATE
// =======================

self.addEventListener('install', () => {
	self.skipWaiting();
});

self.addEventListener('activate', (event) => {
	event.waitUntil(self.clients.claim());
});

// =======================
// PUSH
// =======================

self.addEventListener('push', (event) => {
	let data = {};

	try {
		data = event.data ? event.data.json() : {};
	} catch (e) {
		data = { title: 'New message', body: event.data?.text() };
	}

	const title = data.title || 'HearthChat';
	const options = {
		body: data.body || '',
		icon: './icon.png',
		badge: './icon.png',
		data: {
			url: data.url || '/'
		}
	};

	event.waitUntil(
		self.registration.showNotification(title, options)
	);
});

// =======================
// CLICK
// =======================

self.addEventListener('notificationclick', (event) => {
	event.notification.close();

	const url = event.notification.data?.url || '/';

	event.waitUntil(
		(async () => {
			const allClients = await clients.matchAll({
				type: 'window',
				includeUncontrolled: true
			});

			for (const client of allClients) {
				if (client.url.includes(url) && 'focus' in client) {
					return client.focus();
				}
			}

			if (clients.openWindow) {
				return clients.openWindow(url);
			}
		})()
	);
});