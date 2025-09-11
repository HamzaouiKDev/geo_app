// js/main.js

document.addEventListener('DOMContentLoaded', () => {
    // --- Configuration de la base de données ---
    const db = new Dexie('enqueteDB');
    db.version(1).stores({
        reponses: '++id, objectId, timestamp, synced'
    });

    // --- Initialisation de la carte ---
    const map = L.map('map').setView([37.2736, 9.8781], 16);

    // Définition de la couche de base "Plan" (OpenStreetMap)
const osmLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    maxZoom: 19
});

// Définition de la couche de base "Satellite" (Esri World Imagery)
const satelliteLayer = L.tileLayer('https://{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}',{
    maxZoom: 20,
    subdomains:['mt0','mt1','mt2','mt3'],
    attribution: 'Map data &copy;2024 Google'
});
// Ajout de la couche par défaut à la carte (le plan s'affichera au démarrage)
osmLayer.addTo(map);
// Création d'un objet pour contenir nos couches de base
const baseMaps = {
    "Plan": osmLayer,
    "Satellite": satelliteLayer
};

// Ajout du contrôle des couches à la carte
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

    // --- Chargement des données GeoJSON ---
    async function loadData(map) {
        try {
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
          // NEW CODE
// First, define your custom building icon
const buildingIcon = L.icon({
    iconUrl: 'img/building-icon.png', // Path to your new icon
    iconSize: [32, 32],               // Size of the icon in pixels
    iconAnchor: [16, 32],             // Point of the icon that corresponds to marker's location
    popupAnchor: [0, -32]             // Point from which the popup should open
});

// Then, load the GeoJSON layer using the new icon
L.geoJSON(batiData, {
    pointToLayer: (feature, latlng) => {
        // Use L.marker with your custom icon instead of L.rectangle
        return L.marker(latlng, { icon: buildingIcon });
    },
    onEachFeature: (feature, layer) => {
        // The hover and click events remain the same
        layer.bindTooltip(`Bâtiment ID: ${feature.properties.OBJECTID}`);
        layer.on('click', () => {
            openQuestionnaire(feature.properties);
        });
    }
}).addTo(map);
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
        
        closeQuestionnaire();
        alert('Réponse enregistrée localement avec succès !');
    });

    async function saveResponse(data) {
        try {
            await db.reponses.add(data);
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