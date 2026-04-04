self.addEventListener("push", (event) => {
  if (!event.data) return;

  let payload = {};
  try {
    payload = event.data.json();
  } catch (e) {
    payload = { title: "FitBuddy", body: event.data.text() };
  }

  const title = payload.title || "FitBuddy";
  const options = {
    body: payload.body || "",
    data: {
      ...(payload.data || {}),
      linkUrl: payload.linkUrl || "/",
    },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification?.data?.linkUrl || "/";
  event.waitUntil(clients.openWindow(url));
});

