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

