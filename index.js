var map = L.map('map',{
    zoomControl:false
}).setView([44.9740, -93.2354], 15.5);
L.tileLayer('https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    maxZoom:18,
    minZoom:13
}).addTo(map);
L.control.zoom({
    position: 'bottomright'
}).addTo(map);

var layerGroups = {};

function onEachFeature(feature, layer) {
    if (feature.properties && feature.properties.name) {
        var popupContent = feature.properties.name;
        
        if (feature.properties.hall) {
            popupContent += "<br>Building: " + feature.properties.hall;
        }
        
        if (feature.properties.floor) {
            popupContent += "<br>Floor: " + feature.properties.floor;
        }
        
        if (feature.properties.note) {
            popupContent += "<br>Note: " + feature.properties.note;
        }
        
        layer.bindPopup(popupContent);
    }
}

var markerColors = {
    coffee: '#8B4513',      
    study: '#2E8B57',       
    microwaves: '#FF6347',  
    vending: '#4169E1'      
};

function createCustomMarker(feature, latlng, color) {
    return L.marker(latlng, {
        icon: L.icon({
            iconUrl: 'data:image/svg+xml;base64,' + btoa(`
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 25 41" width="25" height="41">
                    <path fill="${color}" stroke="#fff" stroke-width="1.5" d="M12.5 0C5.6 0 0 5.6 0 12.5c0 12.5 12.5 28.5 12.5 28.5s12.5-16 12.5-28.5C25 5.6 19.4 0 12.5 0z"/>
                    <circle cx="12.5" cy="12.5" r="4" fill="#fff"/>
                </svg>
            `),
            iconSize: [25, 41],
            iconAnchor: [12, 41],
            popupAnchor: [1, -34]
        })
    });
}

// when adding a new set of objects, copy the following line and change test to your variable

layerGroups.coffee = L.geoJSON(coffee, {
    onEachFeature: onEachFeature
}).addTo(map);

layerGroups.vending = L.geoJSON(vending, {
    onEachFeature: onEachFeature
}).addTo(map);

layerGroups.study = L.geoJSON(study, { 
    onEachFeature: onEachFeature 
}).addTo(map);

layerGroups.microwaves = L.geoJSON(microwaves1, {
    onEachFeature: onEachFeature
}).addTo(map);

// Function to toggle layer visibility
function toggleLayer(category, isVisible) {
    if (layerGroups[category]) {
        if (isVisible) {
            map.addLayer(layerGroups[category]);
        } else {
            map.removeLayer(layerGroups[category]);
        }
    }
}

// Wait for DOM to load before binding events
document.addEventListener('DOMContentLoaded', function() {
    // Bind toggle button events
    document.querySelectorAll('.toggle-btn').forEach(function(button) {
        button.addEventListener('click', function() {
            var category = this.getAttribute('data-category');
            var isActive = this.classList.contains('active');
            
            if (isActive) {
                this.classList.remove('active');
                toggleLayer(category, false);
            } else {
                this.classList.add('active');
                toggleLayer(category, true);
            }
        });
    });
});

