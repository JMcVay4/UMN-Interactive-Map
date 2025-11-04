var campusLocations = {
    'East Bank': {
        center: [44.9740, -93.2354],
        zoom: 15.5
    },
    'West Bank': {
        center: [44.9670, -93.2520],
        zoom: 15.5
    },
    'St. Paul': {
        center: [44.9850, -93.1850],
        zoom: 15.5
    }
};

var map = L.map('map',{
    zoomControl:false
}).setView(campusLocations['East Bank'].center, campusLocations['East Bank'].zoom);
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
    vending: '#4169E1', 
    bike: '#FFD700'     
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
    pointToLayer: (feature, latlng) => createCustomMarker(feature, latlng, markerColors.coffee),
    onEachFeature: onEachFeature
}).addTo(map);

layerGroups.vending = L.geoJSON(vending, {
    pointToLayer: (feature, latlng) => createCustomMarker(feature, latlng, markerColors.vending),
    onEachFeature: onEachFeature
}).addTo(map);

layerGroups.study = L.geoJSON(study, {
    pointToLayer: (feature, latlng) => createCustomMarker(feature, latlng, markerColors.study),
    onEachFeature: onEachFeature
}).addTo(map);

layerGroups.microwaves = L.geoJSON(microwaves1, {
    pointToLayer: (feature, latlng) => createCustomMarker(feature, latlng, markerColors.microwaves),
    onEachFeature: onEachFeature
}).addTo(map);

layerGroups.bike = L.geoJSON(bike, {
    pointToLayer: (feature, latlng) => createCustomMarker(feature, latlng, markerColors.bike),
    onEachFeature: onEachFeature
}).addTo(map);

// Function to toggle layer visibility
function toggleLayer(category, isVisible) {
    // If searching, don't toggle layers normally
    if (isSearching) {
        return;
    }
    
    if (layerGroups[category]) {
        if (isVisible) {
            map.addLayer(layerGroups[category]);
        } else {
            map.removeLayer(layerGroups[category]);
        }
    }
}

// Search functionality: store all markers for searching
var allMarkers = [];

// Collect all markers into search array
function collectAllMarkers() {
    allMarkers = [];
    Object.keys(layerGroups).forEach(function(category) {
        layerGroups[category].eachLayer(function(layer) {
            if (layer.feature) {
                var feature = layer.feature;
                var searchText = '';
                if (feature.properties) {
                    if (feature.properties.name) searchText += feature.properties.name + ' ';
                    if (feature.properties.hall) searchText += feature.properties.hall + ' ';
                    if (feature.properties.location) searchText += feature.properties.location + ' ';
                    if (feature.properties.floor) searchText += feature.properties.floor + ' ';
                    if (feature.properties.note) searchText += feature.properties.note + ' ';
                }
                allMarkers.push({
                    layer: layer,
                    feature: feature,
                    searchText: searchText.toLowerCase().trim(),
                    category: category
                });
            }
        });
    });
}

// Search markers and show only matching results
var isSearching = false;
var searchResultLayers = [];

function searchMarkers(query) {
    // Clear previous search result layers
    searchResultLayers.forEach(function(layer) {
        if (map.hasLayer(layer)) {
            map.removeLayer(layer);
        }
    });
    searchResultLayers = [];
    
    if (!query || query.trim() === '') {
        // Clear search: restore all markers visibility based on toggle button states
        isSearching = false;
        
        // Restore all layer visibility based on toggle button states
        document.querySelectorAll('.toggle-btn').forEach(function(button) {
            var category = button.getAttribute('data-category');
            var isActive = button.classList.contains('active');
            toggleLayer(category, isActive);
        });
        
        return [];
    }
    
    isSearching = true;
    var searchQuery = query.toLowerCase().trim();
    var results = allMarkers.filter(function(marker) {
        return marker.searchText.includes(searchQuery);
    });
    
    // Hide all original layer groups first
    Object.keys(layerGroups).forEach(function(category) {
        if (map.hasLayer(layerGroups[category])) {
            map.removeLayer(layerGroups[category]);
        }
    });
    
    // Show only matching markers
    if (results.length > 0) {
        var bounds = L.latLngBounds([]);
        var categoriesToShow = {};
        
        // Group results by category
        results.forEach(function(result) {
            categoriesToShow[result.category] = true;
            
            // Get coordinates from feature geometry
            var coords = result.feature.geometry.coordinates;
            if (coords && coords.length >= 2) {
                // Note: GeoJSON format is [longitude, latitude], Leaflet needs [latitude, longitude]
                var latlng = [coords[1], coords[0]];
                bounds.extend(latlng);
            }
        });
        
        // Create filtered layer groups with only matching markers
        Object.keys(categoriesToShow).forEach(function(category) {
            if (layerGroups[category]) {
                // Create a new GeoJSON layer with only matching features
                var matchingFeatures = results
                    .filter(function(r) { return r.category === category; })
                    .map(function(r) { return r.feature; });
                
                if (matchingFeatures.length > 0) {
                    var filteredLayer = L.geoJSON({
                        type: "FeatureCollection",
                        features: matchingFeatures
                    }, {
                        pointToLayer: function(feature, latlng) {
                            var color = markerColors[category] || '#808080';
                            return createCustomMarker(feature, latlng, color);
                        },
                        onEachFeature: onEachFeature
                    });
                    
                    filteredLayer.addTo(map);
                    searchResultLayers.push(filteredLayer);
                }
            }
        });
        
        // If only one result, zoom in; if multiple, show all results
        if (results.length === 1) {
            var coords = results[0].feature.geometry.coordinates;
            if (coords && coords.length >= 2) {
                map.setView([coords[1], coords[0]], 17);
            }
        } else if (results.length > 1) {
            map.fitBounds(bounds, {padding: [50, 50]});
        }
    }
    
    return results;
}

// Wait for DOM to load before binding events
document.addEventListener('DOMContentLoaded', function() {
    // Collect all markers
    setTimeout(collectAllMarkers, 500); // Wait for all layers to load
    
    // Campus dropdown selection event
    document.querySelectorAll('.dropdown-content a').forEach(function(link) {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            var campusName = this.getAttribute('data-campus') || this.textContent.trim();
            if (campusLocations[campusName]) {
                var location = campusLocations[campusName];
                map.setView(location.center, location.zoom);
                // Update dropdown button text
                var dropbtn = document.getElementById('campusDropdown');
                if (dropbtn) {
                    dropbtn.innerHTML = campusName + ' <i class="fas fa-angle-down"></i>';
                }
            }
        });
    });
    
    // Search input event
    var searchInput = document.getElementById('searchInput');
    if (searchInput) {
        var searchTimeout;
        searchInput.addEventListener('input', function() {
            clearTimeout(searchTimeout);
            var query = this.value;
            searchTimeout = setTimeout(function() {
                searchMarkers(query);
            }, 300); // Debounce
        });
        
        // Enter key search
        searchInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                clearTimeout(searchTimeout);
                searchMarkers(this.value);
            }
        });
    }
    
    // Bind toggle button events
    document.querySelectorAll('.toggle-btn').forEach(function(button) {
        var category = button.getAttribute('data-category');
        if (category === 'coffee') {
            button.classList.add('active');
            toggleLayer(category, true);
        } else {
            button.classList.remove('active');
            toggleLayer(category, false);
        }
    });
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
            // Recollect markers if not searching (layer may have changed)
            if (!isSearching) {
                setTimeout(collectAllMarkers, 100);
            }
        });
    });
});

