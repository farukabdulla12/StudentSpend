const CACHE_NAME = 'studentspend-cache-v2';

// অফলাইনত চলিবলৈ প্ৰয়োজনীয় সকলো ফাইলৰ নাম
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './dashboard.html',
  './forgot-password.html',
  './reset-password.html',
  './style.css',
  './dashboard.css',
  './script.js',
  './dashboard.js',
  './connection.js',
  './forgot-password.js',
  './reset-password.js',
  // External Libraries (Fonts আৰু CDN)
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2',
  'https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Outfit:wght@500;600;700&display=swap',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.2/css/all.min.css'
];

// ১. ফাইলসমূহ ব্ৰাউজাৰৰ Cache-ত সংৰক্ষণ কৰা
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    }).then(() => self.skipWaiting())
  );
});

// ২. পুৰণি Cache ডিলিট কৰা
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// ৩. অফলাইনত Cache-ৰ পৰা ডাটা Fetch কৰা (Network first, fallback to Cache)
self.addEventListener('fetch', (event) => {
  // Supabase API বা বাহিৰা POST অনুৰোধ কেচ নকৰিবলৈ
  if (event.request.method !== 'GET' || event.request.url.includes('supabase.co')) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        // নেটৱৰ্ক থাকিলে নতুন ফাইল কেচত আপডেট কৰা
        if (networkResponse && networkResponse.status === 200) {
          const responseClone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone);
          });
        }
        return networkResponse;
      })
      .catch(() => {
        // নেটৱৰ্ক নথকা সময়ত (Offline) কেচৰ পৰা ফাইল দিয়া
        return caches.match(event.request).then((cachedResponse) => {
          if (cachedResponse) {
            return cachedResponse;
          }
          // যদি পেজটো বিচাৰি নাপায় তেন্তে dashboard.html লৈ যাব
          if (event.request.mode === 'navigate') {
            return caches.match('./dashboard.html');
          }
        });
      })
  );
});