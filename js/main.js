// js/main.js

document.addEventListener('DOMContentLoaded', () => {
    // --- Configuration de la base de données ---
    const db = new Dexie('enqueteDB');
    db.version(1).stores({
        reponses: '++id, objectId, timestamp, synced, statut' // Ajout du champ statut
    });

    // --- Initialisation de la carte ---
    const map = L.map('map').setView([37.2736, 9.8781], 16);

    // Définition des couches de base
    const osmLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19
    });
    const satelliteLayer = L.tileLayer('https://{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}',{
        maxZoom: 20,
        subdomains:['mt0','mt1','mt2','mt3'],
        attribution: 'Map data &copy;2024 Google'
    });

    osmLayer.addTo(map);
    const baseMaps = { "Plan": osmLayer, "Satellite": satelliteLayer };
    L.control.layers(baseMaps).addTo(map);

    // --- Géolocalisation ---
    navigator.geolocation.getCurrentPosition(
        (position) => {
            const { latitude, longitude } = position.coords;
            L.marker([latitude, longitude]).addTo(map).bindPopup("<b>Vous êtes ici</b>");
        },
        () => console.warn("Géolocalisation refusée."),
        { enableHighAccuracy: true }
    );
    
    // Pour garder une référence à tous les marqueurs créés
    const markers = {};

    // --- Chargement des données GeoJSON ---
    async function loadData(map) {
        try {
            // --- Lire les réponses existantes d'IndexedDB d'abord ---
            const reponsesArray = await db.reponses.toArray();
            const reponsesMap = new Map(reponsesArray.map(item => [item.objectId, item]));

            // --- 1. Charger les îlots (Polygones) ---
            const ilotsResponse = await fetch('data/ilots.json');
            const ilotsData = await ilotsResponse.json();
            const ilotLayer = L.geoJSON(ilotsData, {
                style: { color: "#ff7800", weight: 3, opacity: 0.7 }
            });
            map.fitBounds(ilotLayer.getBounds());
            ilotLayer.addTo(map);

            // --- 2. Charger les bâtiments (Points) ---
            const batiResponse = await fetch('data/batiments.json');
            const batiData = await batiResponse.json();

            const oms = new OverlappingMarkerSpiderfier(map);

            const batiLayer = L.geoJSON(batiData, {
                pointToLayer: (feature, latlng) => {
                    const objectId = feature.properties.OBJECTID;
                    const reponse = reponsesMap.get(String(objectId));
                    
                    const statusClass = reponse ? `status-${reponse.statut}` : '';

                    const circleIcon = L.divIcon({
                        className: `custom-circle-icon ${statusClass}`,
                        iconSize: [16, 16]
                    });

                    const marker = L.marker(latlng, { icon: circleIcon });
                    marker.feature = feature;
                    
                    markers[objectId] = marker;
                    
                    return marker;
                },
                onEachFeature: (feature, layer) => {
                    layer.bindTooltip(`Bâtiment ID: ${feature.properties.OBJECTID}`);
                    oms.addMarker(layer);
                }
            });
            
            batiLayer.addTo(map);

            oms.addListener('click', (marker) => {
                openQuestionnaire(marker.feature.properties);
            });

        } catch (error) {
            console.error("Erreur de chargement des données GeoJSON:", error);
            alert("Impossible de charger les données de la carte.");
        }
    }

    loadData(map);

    // --- Logique du Questionnaire ---
    const modal = document.getElementById('questionnaire-modal');
    const form = document.getElementById('enquete-form');
    const menageIdSpan = document.getElementById('menage-id');
    const closeButton = document.querySelector('.close-button');

    function openQuestionnaire(properties) {
        menageIdSpan.textContent = properties.OBJECTID;
        form.dataset.objectId = properties.OBJECTID;
        modal.style.display = 'block';
    }

    function closeQuestionnaire() {
        modal.style.display = 'none';
        form.reset();
    }

    closeButton.onclick = closeQuestionnaire;
    window.onclick = (event) => {
        if (event.target == modal) closeQuestionnaire();
    };

    form.addEventListener('submit', async (event) => {
        event.preventDefault();
        const formData = new FormData(form);
        const data = Object.fromEntries(formData.entries());
        data.objectId = form.dataset.objectId;
        data.timestamp = new Date().toISOString();
        data.synced = 0;

        await saveResponse(data);
        
        const markerToUpdate = markers[data.objectId];
        if (markerToUpdate) {
            const newIcon = L.divIcon({
                className: `custom-circle-icon status-${data.statut}`,
                iconSize: [16, 16]
            });
            markerToUpdate.setIcon(newIcon);
        }

        closeQuestionnaire();
        alert('Réponse enregistrée localement avec succès !');
    });

    async function saveResponse(data) {
        try {
            await db.reponses.put(data, data.objectId); 
            console.log("Réponse sauvegardée dans IndexedDB.");
        } catch (error) {
            console.error("Échec de l'enregistrement dans IndexedDB:", error);
        }
    }
});

// --- Enregistrement du Service Worker ---
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js')
            .then(reg => console.log('Service Worker enregistré.', reg))
            .catch(err => console.error('Erreur Service Worker:', err));
    });
}