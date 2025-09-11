// sw.js

const CACHE_NAME = 'enquete-app-cache-v1';
const URLS_TO_CACHE = [
    '/',
    '/index.html',
    '/css/style.css',
    '/js/main.js',
    '/data/ilots.json',
    '/data/bati_converti.json',
    '/manifest.json',
    '/img/icon-192.png',
    'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
    'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',
    'https://unpkg.com/dexie@3.2.5/dist/dexie.js'
];

// Installation du Service Worker et mise en cache de l'App Shell
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('Cache ouvert, mise en cache des fichiers de l\'app shell.');
                return cache.addAll(URLS_TO_CACHE);
            })
    );
});

// Stratégie "Cache-First, then Network"
self.addEventListener('fetch', event => {
    // Ne pas mettre en cache les requêtes autres que GET
    if (event.request.method !== 'GET') {
        return;
    }

    event.respondWith(
        caches.match(event.request)
            .then(cachedResponse => {
                // Si la ressource est dans le cache, on la retourne
                if (cachedResponse) {
                    return cachedResponse;
                }

                // Sinon, on va la chercher sur le réseau
                return fetch(event.request).then(
                    networkResponse => {
                        // On met en cache la nouvelle ressource et on la retourne
                        return caches.open(CACHE_NAME).then(cache => {
                            // On clone la réponse car elle ne peut être consommée qu'une seule fois
                            cache.put(event.request, networkResponse.clone());
                            return networkResponse;
                        });
                    }
                ).catch(error => {
                    console.error("Fetch a échoué:", error);
                    // Vous pouvez retourner une page d'erreur hors-ligne ici si nécessaire
                });
            })
    );
});

// Nettoyage des anciens caches
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.filter(name => name !== CACHE_NAME).map(name => caches.delete(name))
            );
        })
    );
});