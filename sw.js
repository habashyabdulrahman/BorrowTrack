const CACHE_NAME = "borrowtrack-v1";
const ASSETS = [
  "./",
  "./index.html",
  "./styles.css",
  "./app.js",
  "https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@300;400;500;600;700&display=swap",
];

// تثبيت الـ Service Worker وحفظ الملفات في الكاش
self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)));
});

// استرجاع الملفات من الكاش في حالة انقطاع الإنترنت
self.addEventListener("fetch", (e) => {
  e.respondWith(caches.match(e.request).then((res) => res || fetch(e.request)));
});
