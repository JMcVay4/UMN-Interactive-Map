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

// Category name mapping for search (category key -> display names)
var categoryNames = {
    coffee: ['coffee', 'coffee shop', 'coffee shops', 'cafe', 'café', 'espresso', 'latte', 'cappuccino', 'brew', 'java', 'roast', 'barista', '咖啡', '咖啡店', '咖啡馆', '星巴克', '拿铁', '美式咖啡'],
    study: ['study', 'study space', 'study spaces', 'studying', 'library', 'reading', 'quiet', 'desk', 'workspace', 'learning', 'academic', '学习', '学习空间', '自习', '自习室', '图书馆', '阅览室', '安静'],
    vending: ['vending', 'vending machine', 'vending machines', 'snack', 'snacks', 'drink', 'drinks', 'soda', 'candy', 'chips', 'food machine', '自动售货机', '售货机', '零食', '饮料', '贩卖机'],
    microwaves: ['microwave', 'microwaves', 'oven', 'heat', 'warm', 'food', 'lunch', 'meal', '微波炉', '加热', '热饭', '午餐', '食物'],
    bike: ['bike', 'bicycle', 'bike parking', 'bicycle parking', 'cycling', 'cyclist', 'biker', 'bikes', 'bicycles', 'rack', 'bike rack', '自行车', '单车', '自行车停车', '停车', '车架', '自行车架'],
    bathrooms: ['bathroom', 'bathrooms', 'restroom', 'restrooms', 'toilet', 'toilets', 'washroom', 'washrooms', 'gender-neutral', 'gender neutral', 'all-gender', 'all gender', 'unisex', 'neutral', '卫生间', '洗手间', '厕所', '中性卫生间', '无性别卫生间', '通用卫生间']
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
var originalButtonOrder = []; // Store original button order for restoration

// Function to search by category
function searchByCategory(query) {
    var searchQuery = query.toLowerCase().trim();
    var matchingCategories = [];
    
    // Find matching categories (exclude filler)
    Object.keys(categoryNames).forEach(function(category) {
        // Skip filler category
        if (category === 'filler') {
            return;
        }
        
        var names = categoryNames[category];
        var matches = names.some(function(name) {
            return name.toLowerCase().includes(searchQuery);
        });
        if (matches) {
            matchingCategories.push(category);
        }
    });
    
    return matchingCategories;
}

// Function to search markers
function searchMarkers(query, mode) {
    // Clear previous search result layers
    searchResultLayers.forEach(function(layer) {
        if (map.hasLayer(layer)) {
            map.removeLayer(layer);
        }
    });
    searchResultLayers = [];
    
    // Get no results element
    var noResultsElement = document.getElementById('searchNoResults');
    
    if (!query || query.trim() === '') {
        // Clear search: restore all markers visibility based on toggle button states
        isSearching = false;
        
        // Hide no results message
        if (noResultsElement) {
            noResultsElement.style.display = 'none';
        }
        
        // Restore all buttons visibility and order
        var toggleButtonsContainer = document.querySelector('.toggle-buttons');
        if (toggleButtonsContainer && originalButtonOrder.length > 0) {
            // Remove all buttons
            var allButtons = Array.from(document.querySelectorAll('.toggle-btn'));
            allButtons.forEach(function(btn) {
                toggleButtonsContainer.removeChild(btn);
            });
            
            // Restore original order
            originalButtonOrder.forEach(function(btn) {
                btn.style.display = '';
                toggleButtonsContainer.appendChild(btn);
            });
        } else {
            // Fallback: just show all buttons
            document.querySelectorAll('.toggle-btn').forEach(function(button) {
                button.style.display = '';
            });
        }
        
        // Restore all layer visibility based on toggle button states
        document.querySelectorAll('.toggle-btn').forEach(function(button) {
            var category = button.getAttribute('data-category');
            var isActive = button.classList.contains('active');
            toggleLayer(category, isActive);
        });
        
        return [];
    }
    
    isSearching = true;
    var results = [];
    
    // Hide all original layer groups first
    Object.keys(layerGroups).forEach(function(category) {
        if (map.hasLayer(layerGroups[category])) {
            map.removeLayer(layerGroups[category]);
        }
    });
    
    if (mode === 'category') {
        // Search by category
        var matchingCategories = searchByCategory(query);
        var toggleButtonsContainer = document.querySelector('.toggle-buttons');
        
        if (matchingCategories.length > 0) {
            // Hide no results message
            if (noResultsElement) {
                noResultsElement.style.display = 'none';
            }
            
            // First, deactivate all toggle buttons
            document.querySelectorAll('.toggle-btn').forEach(function(button) {
                button.classList.remove('active');
            });
            
            // Collect matching and non-matching buttons
            var matchingButtons = [];
            var nonMatchingButtons = [];
            
            document.querySelectorAll('.toggle-btn').forEach(function(button) {
                var category = button.getAttribute('data-category');
                if (matchingCategories.indexOf(category) !== -1) {
                    matchingButtons.push(button);
                    button.classList.add('active');
                    button.style.display = ''; // Show matching buttons
                } else {
                    nonMatchingButtons.push(button);
                    button.style.display = 'none'; // Hide non-matching buttons
                }
            });
            
            // Reorder: matching buttons first, then non-matching (hidden)
            if (toggleButtonsContainer) {
                // Remove all buttons
                matchingButtons.forEach(function(btn) {
                    toggleButtonsContainer.removeChild(btn);
                });
                nonMatchingButtons.forEach(function(btn) {
                    toggleButtonsContainer.removeChild(btn);
                });
                
                // Add matching buttons first
                matchingButtons.forEach(function(btn) {
                    toggleButtonsContainer.appendChild(btn);
                });
                
                // Add non-matching buttons (hidden) at the end
                nonMatchingButtons.forEach(function(btn) {
                    toggleButtonsContainer.appendChild(btn);
                });
            }
            
            var bounds = L.latLngBounds([]);
            
            matchingCategories.forEach(function(category) {
                if (layerGroups[category]) {
                    // Collect all features from this category
                    var categoryFeatures = [];
                    layerGroups[category].eachLayer(function(layer) {
                        if (layer.feature) {
                            categoryFeatures.push(layer.feature);
                            
                            // Get coordinates for bounds
                            var coords = layer.feature.geometry.coordinates;
                            if (coords && coords.length >= 2) {
                                var latlng = [coords[1], coords[0]];
                                bounds.extend(latlng);
                            }
                        }
                    });
                    
                    if (categoryFeatures.length > 0) {
                        var filteredLayer = L.geoJSON({
                            type: "FeatureCollection",
                            features: categoryFeatures
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
            
            // Zoom to show all matching categories
            if (bounds.isValid()) {
                map.fitBounds(bounds, {padding: [50, 50]});
            }
            
            results = matchingCategories;
        } else {
            // Show no results message
            if (noResultsElement) {
                noResultsElement.style.display = 'block';
            }
            
            // Hide all buttons when no results
            document.querySelectorAll('.toggle-btn').forEach(function(button) {
                button.style.display = 'none';
                button.classList.remove('active');
            });
        }
    } else {
        // Search by mark (original search logic)
        // Restore all buttons visibility when searching by mark
        document.querySelectorAll('.toggle-btn').forEach(function(button) {
            button.style.display = '';
        });
        
        // Restore original button order if needed
        var toggleButtonsContainer = document.querySelector('.toggle-buttons');
        if (toggleButtonsContainer && originalButtonOrder.length > 0) {
            var currentButtons = Array.from(document.querySelectorAll('.toggle-btn'));
            var needsReorder = false;
            
            // Check if order needs to be restored
            for (var i = 0; i < Math.min(currentButtons.length, originalButtonOrder.length); i++) {
                if (currentButtons[i] !== originalButtonOrder[i]) {
                    needsReorder = true;
                    break;
                }
            }
            
            if (needsReorder) {
                currentButtons.forEach(function(btn) {
                    toggleButtonsContainer.removeChild(btn);
                });
                originalButtonOrder.forEach(function(btn) {
                    toggleButtonsContainer.appendChild(btn);
                });
            }
        }
        
        var searchQuery = query.toLowerCase().trim();
        results = allMarkers.filter(function(marker) {
            return marker.searchText.includes(searchQuery);
        });
        
        // Show only matching markers
        if (results.length > 0) {
            // Hide no results message
            if (noResultsElement) {
                noResultsElement.style.display = 'none';
            }
            
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
        } else {
            // Show no results message
            if (noResultsElement) {
                noResultsElement.style.display = 'block';
            }
        }
    }
    
    return results;
}

// Wait for DOM to load before binding events
document.addEventListener('DOMContentLoaded', function() {
    // Save original button order for restoration
    document.querySelectorAll('.toggle-btn').forEach(function(button) {
        originalButtonOrder.push(button);
    });
    
    // Bind toggle button events
    document.querySelectorAll('.toggle-btn').forEach(function(button) {
        var category = button.getAttribute('data-category');
        if (category === coffee) {
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
        });
    });
    
    // Bind campus dropdown events
    document.querySelectorAll('.dropdown-content a[data-campus]').forEach(function(link) {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            var campusName = this.getAttribute('data-campus');
            var campus = campusLocations[campusName];
            
            if (campus) {
                // Update dropdown button text
                var dropdownBtn = document.getElementById('campusDropdown');
                if (dropdownBtn) {
                    dropdownBtn.innerHTML = campusName + ' <i class="fas fa-angle-down"></i>';
                }
                
                // Fly to the campus location
                map.flyTo(campus.center, campus.zoom);
            }
        });
    });
    
    // Initialize marker collection
    collectAllMarkers();
    
    // Bind search input events
    var searchInput = document.getElementById('searchInput');
    if (searchInput) {
        // Search on input
        searchInput.addEventListener('input', function() {
            var query = this.value;
            var searchMode = document.querySelector('input[name="searchMode"]:checked');
            var mode = searchMode ? searchMode.value : 'mark';
            searchMarkers(query, mode);
        });
        
        // Also trigger search when search mode changes
        document.querySelectorAll('input[name="searchMode"]').forEach(function(radio) {
            radio.addEventListener('change', function() {
                var query = searchInput.value;
                var mode = this.value;
                searchMarkers(query, mode);
            });
        });
    }
});

