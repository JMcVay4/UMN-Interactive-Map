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

var map = L.map('map', {
    zoomControl: false
}).setView(campusLocations['East Bank'].center, campusLocations['East Bank'].zoom);

L.tileLayer('https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    maxZoom: 18,
    minZoom: 13
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

        if (feature.properties.stop) {
            popupContent += "<br>Stop: " + feature.properties.stop;
        }

        if (feature.properties.route) {
            popupContent += "<br>Routes: " + feature.properties.route;
        }

        layer.bindPopup(popupContent);
    }
}

var markerColors = {
    coffee: { url: "icons/coffee.png", size: [25, 25] },
    vending: { url: "icons/vending.png", size: [17, 21] },
    study: { url: "icons/book.png", size: [20, 24] },
    microwaves: { url: "icons/microwave.png", size: [24, 24] },
    bathrooms: { url: "icons/toilet.png", size: [24, 24] },
    parkinggarages: { url: "icons/parking.png", size: [21, 21] },
    busstops: { url: "icons/bus.png", size: [30, 30] },
    bike: { url: "icons/bike.png", size: [30, 30] },
};

// Category name mapping for search (category key -> display names)
var categoryNames = {
    coffee: ['coffee', 'coffee shop', 'coffee shops', 'cafe', 'café', 'espresso', 'latte', 'cappuccino', 'brew', 'java', 'roast', 'barista', '咖啡', '咖啡店', '咖啡馆', '星巴克', '拿铁', '美式咖啡'],
    study: ['study', 'study space', 'study spaces', 'studying', 'library', 'reading', 'quiet', 'desk', 'workspace', 'learning', 'academic', '学习', '学习空间', '自习', '自习室', '图书馆', '阅览室', '安静'],
    vending: ['vending', 'vending machine', 'vending machines', 'snack', 'snacks', 'drink', 'drinks', 'soda', 'candy', 'chips', 'food machine', '自动售货机', '售货机', '零食', '饮料', '贩卖机'],
    microwaves: ['microwave', 'microwaves', 'oven', 'heat', 'warm', 'food', 'lunch', 'meal', '微波炉', '加热', '热饭', '午餐', '食物'],
    bike: ['bike', 'bicycle', 'bike parking', 'bicycle parking', 'cycling', 'cyclist', 'biker', 'bikes', 'bicycles', 'rack', 'bike rack', '自行车', '单车', '自行车停车', '停车', '车架', '自行车架'],
    bathrooms: ['bathroom', 'bathrooms', 'restroom', 'restrooms', 'toilet', 'toilets', 'washroom', 'washrooms', 'gender-neutral', 'gender neutral', 'all-gender', 'all gender', 'unisex', 'neutral', '卫生间', '洗手间', '厕所', '中性卫生间', '无性别卫生间', '通用卫生间'],
    parkinggarages: ['parking', 'parking garage', 'parking garages', 'garage', 'garages', 'car park', 'car parking', 'vehicle', '停车', '停车场', '停车库', '车库', '停车位'],
    busstops: ['bus', 'bus stop', 'bus stops', 'busstop', 'busstation', 'bus station', 'transit', 'transportation', 'gopher bus', '公交车', '公交站', '巴士', '巴士站', '公交车站', '交通']
};

function createCustomMarker(feature, latlng, iconOrColor) {
    let icon;
    if (typeof iconOrColor === "object") {
        // custom icon
        icon = L.icon({
            iconUrl: iconOrColor.url,
            iconSize: iconOrColor.size || [25, 41],
            iconAnchor: [
                iconOrColor.size ? iconOrColor.size[0] / 2 : 12,
                iconOrColor.size ? iconOrColor.size[1] : 41
            ],
            popupAnchor: [1, -34]
        });
    } else {
        // default icon
        icon = L.icon({
            iconUrl: 'data:image/svg+xml;base64,' + btoa(`
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 25 41" width="25" height="41">
                    <path fill="${iconOrColor}" stroke="#fff" stroke-width="1.5" d="M12.5 0C5.6 0 0 5.6 0 12.5c0 12.5 12.5 28.5 12.5 28.5s12.5-16 12.5-28.5C25 5.6 19.4 0 12.5 0z"/>
                    <circle cx="12.5" cy="12.5" r="4" fill="#fff"/>
                </svg>
            `),
            iconSize: [25, 41],
            iconAnchor: [12, 41],
            popupAnchor: [1, -34]
        });
    }

    return L.marker(latlng, { icon: icon });
}

// Loads one category's approved locations from the backend and renders them
// as a layer group, mirroring the way the old static waypoints/*.js files
// were rendered. Resolves true/false (never rejects) so callers can tell
// which categories failed without Promise.all short-circuiting.
function loadCategory(category) {
    var url = API_BASE + "/api/locations?category=" + encodeURIComponent(category);
    return fetch(url)
        .then(function (response) {
            if (!response.ok) {
                throw new Error("HTTP " + response.status);
            }
            return response.json();
        })
        .then(function (data) {
            // Not added to the map here — categories start hidden until the
            // user toggles them on (or a search reveals matching markers).
            layerGroups[category] = L.geoJSON(data, {
                pointToLayer: function (feature, latlng) {
                    return createCustomMarker(feature, latlng, markerColors[category]);
                },
                onEachFeature: onEachFeature
            });
            return true;
        })
        .catch(function (err) {
            console.error("Failed to load '" + category + "' locations from " + url + ":", err);
            return false;
        });
}

var mapLoadingEl = document.getElementById('map-loading-message');
var mapLoadErrorEl = document.getElementById('map-load-error');
var mapLoadErrorTextEl = document.getElementById('map-load-error-text');
var mapLoadRetryBtn = document.getElementById('map-load-retry');
var categoriesPendingRetry = [];

// Fetches the given categories (PostgreSQL, via the backend, is the source
// of truth for map data), showing a loading state while in flight. On
// success, builds the search index over whatever loaded and reveals the
// "select a category" hint (via updateNoCategoryMessage). On failure, shows
// an error with a Retry button that re-attempts only the categories that
// didn't load — it does not block the map itself, which is already
// rendered by this point.
function attemptLoad(categories) {
    if (mapLoadingEl) mapLoadingEl.style.display = 'block';
    if (mapLoadErrorEl) mapLoadErrorEl.style.display = 'none';

    Promise.all(categories.map(function (category) {
        return loadCategory(category).then(function (ok) {
            return { category: category, ok: ok };
        });
    })).then(function (outcomes) {
        var failed = outcomes.filter(function (o) { return !o.ok; }).map(function (o) { return o.category; });
        categoriesPendingRetry = failed;

        if (mapLoadingEl) mapLoadingEl.style.display = 'none';

        if (failed.length > 0) {
            if (mapLoadErrorEl) mapLoadErrorEl.style.display = 'flex';
            if (mapLoadErrorTextEl) {
                mapLoadErrorTextEl.textContent = "Couldn't load " +
                    (failed.length === categories.length ? "campus resources" : failed.length + " categor" + (failed.length === 1 ? "y" : "ies")) +
                    ". The server may be starting up — please try again.";
            }
        } else if (mapLoadErrorEl) {
            mapLoadErrorEl.style.display = 'none';
        }

        collectAllMarkers();
        updateNoCategoryMessage();
    });
}

if (mapLoadRetryBtn) {
    mapLoadRetryBtn.addEventListener('click', function () {
        attemptLoad(categoriesPendingRetry.length > 0 ? categoriesPendingRetry : Object.keys(markerColors));
    });
}

attemptLoad(Object.keys(markerColors));

// Shows/hides the "select a category or search" message based on whether
// any category layer or search result is currently on the map.
function updateNoCategoryMessage() {
    var messageEl = document.getElementById('no-category-message');
    if (!messageEl) return;

    var noResultsElement = document.getElementById('searchNoResults');
    if (noResultsElement && noResultsElement.style.display === 'block') {
        messageEl.style.display = 'none';
        return;
    }
    if (mapLoadingEl && mapLoadingEl.style.display === 'block') {
        messageEl.style.display = 'none';
        return;
    }
    if (mapLoadErrorEl && mapLoadErrorEl.style.display === 'flex') {
        messageEl.style.display = 'none';
        return;
    }

    var anyVisible = Object.keys(layerGroups).some(function (category) {
        return map.hasLayer(layerGroups[category]);
    }) || searchResultLayers.some(function (layer) {
        return map.hasLayer(layer);
    });

    messageEl.style.display = anyVisible ? 'none' : 'block';
}

// Function to toggle layer visibility
function toggleLayer(category, isVisible) {
    if (layerGroups[category]) {
        if (isVisible) {
            map.addLayer(layerGroups[category]);
        } else {
            map.removeLayer(layerGroups[category]);
        }
    }
    updateNoCategoryMessage();
}

// Search functionality: store all markers for searching
var allMarkers = [];

// Collect all markers into search array
function collectAllMarkers() {
    allMarkers = [];
    Object.keys(layerGroups).forEach(function (category) {
        layerGroups[category].eachLayer(function (layer) {
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
var originalButtonStates = {}; // Store original button active states for restoration

// Function to search by category
function searchByCategory(query) {
    var searchQuery = query.toLowerCase().trim();
    var matchingCategories = [];

    // Find matching categories (exclude filler)
    Object.keys(categoryNames).forEach(function (category) {
        // Skip filler category
        if (category === 'filler') {
            return;
        }

        var names = categoryNames[category];
        var matches = names.some(function (name) {
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
    searchResultLayers.forEach(function (layer) {
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

        // Save current button states before restoring (in case they were modified during search)
        var savedStates = {};
        if (Object.keys(originalButtonStates).length > 0) {
            savedStates = originalButtonStates;
        } else {
            // No search happened yet this session, so there's nothing to
            // restore from — just read whatever state the buttons are
            // currently in (categories start off by default; this also
            // respects any manual toggling the user already did).
            var toggleButtonsContainerRestore = document.querySelector('.toggle-buttons');
            if (toggleButtonsContainerRestore) {
                toggleButtonsContainerRestore.querySelectorAll('.toggle-btn').forEach(function (button) {
                    var category = button.getAttribute('data-category');
                    if (category) {
                        savedStates[category] = button.classList.contains('active');
                    }
                });
            }
        }

        // Reset saved button states so they can be saved again on next search
        originalButtonStates = {};

        // Restore all buttons visibility and order (only category buttons in toggleButtonsContainer)
        var toggleButtonsContainer = document.querySelector('.toggle-buttons');
        if (toggleButtonsContainer && originalButtonOrder.length > 0) {
            // Remove all buttons from container
            var allButtons = Array.from(toggleButtonsContainer.querySelectorAll('.toggle-btn'));
            allButtons.forEach(function (btn) {
                if (btn.parentNode === toggleButtonsContainer) {
                    toggleButtonsContainer.removeChild(btn);
                }
            });

            // Restore original order and states (only buttons with category)
            originalButtonOrder.forEach(function (btn) {
                var category = btn.getAttribute('data-category');
                // Only restore buttons with category (not add-btn)
                if (category) {
                    btn.style.display = '';
                    // Restore saved active state
                    if (savedStates[category] !== undefined) {
                        if (savedStates[category]) {
                            btn.classList.add('active');
                        } else {
                            btn.classList.remove('active');
                        }
                    } else {
                        // No saved state at all for this button — default to off.
                        btn.classList.remove('active');
                    }
                    if (btn.parentNode !== toggleButtonsContainer) {
                        toggleButtonsContainer.appendChild(btn);
                    }
                }
            });
        } else {
            // Fallback: just show all category buttons and restore states
            if (toggleButtonsContainer) {
                toggleButtonsContainer.querySelectorAll('.toggle-btn').forEach(function (button) {
                    var category = button.getAttribute('data-category');
                    // Only restore buttons with category (not add-btn)
                    if (category) {
                        button.style.display = '';
                        if (savedStates[category] !== undefined) {
                            if (savedStates[category]) {
                                button.classList.add('active');
                            } else {
                                button.classList.remove('active');
                            }
                        } else {
                            // No saved state at all for this button — default to off.
                            button.classList.remove('active');
                        }
                    }
                });
            }
        }

        // Restore all layer visibility based on toggle button states (only category buttons)
        if (toggleButtonsContainer) {
            toggleButtonsContainer.querySelectorAll('.toggle-btn').forEach(function (button) {
                var category = button.getAttribute('data-category');
                // Only process buttons with category (not add-btn)
                if (category) {
                    var isActive = button.classList.contains('active');
                    toggleLayer(category, isActive);
                }
            });
        }

        return [];
    }

    isSearching = true;
    var results = [];

    // Save button states before search (only if not already saved and we're actually searching)
    if (Object.keys(originalButtonStates).length === 0 && query && query.trim() !== '') {
        var toggleButtonsContainerSave = document.querySelector('.toggle-buttons');
        if (toggleButtonsContainerSave) {
            toggleButtonsContainerSave.querySelectorAll('.toggle-btn').forEach(function (button) {
                var category = button.getAttribute('data-category');
                // Only save buttons with category (not add-btn)
                if (category) {
                    originalButtonStates[category] = button.classList.contains('active');
                }
            });
        }
    }

    if (mode === 'category') {
        // Hide all original layer groups first (only for category search)
        Object.keys(layerGroups).forEach(function (category) {
            if (map.hasLayer(layerGroups[category])) {
                map.removeLayer(layerGroups[category]);
            }
        });
        // Search by category
        var matchingCategories = searchByCategory(query);
        var toggleButtonsContainerCat = document.querySelector('.toggle-buttons');

        if (matchingCategories.length > 0) {
            // Hide no results message
            if (noResultsElement) {
                noResultsElement.style.display = 'none';
            }

            // First, deactivate all toggle buttons (only category buttons, not add-btn)
            if (toggleButtonsContainerCat) {
                toggleButtonsContainerCat.querySelectorAll('.toggle-btn').forEach(function (button) {
                    button.classList.remove('active');
                });
            }

            // Collect matching and non-matching buttons (only from toggleButtonsContainer)
            var matchingButtons = [];
            var nonMatchingButtons = [];

            if (toggleButtonsContainerCat) {
                toggleButtonsContainerCat.querySelectorAll('.toggle-btn').forEach(function (button) {
                    var category = button.getAttribute('data-category');
                    // Skip buttons without category (like add-btn if it's in the container)
                    if (!category) {
                        return;
                    }
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
                // Remove all buttons from container
                var allButtonsInContainer = Array.from(toggleButtonsContainerCat.querySelectorAll('.toggle-btn'));
                allButtonsInContainer.forEach(function (btn) {
                    var btnCategory = btn.getAttribute('data-category');
                    // Only remove buttons with category (not add-btn)
                    if (btnCategory && btn.parentNode === toggleButtonsContainerCat) {
                        toggleButtonsContainerCat.removeChild(btn);
                    }
                });

                // Add matching buttons first (ensure they're visible)
                matchingButtons.forEach(function (btn) {
                    btn.style.display = ''; // Ensure visible
                    toggleButtonsContainerCat.appendChild(btn);
                });

                // Add non-matching buttons (hidden) at the end
                nonMatchingButtons.forEach(function (btn) {
                    btn.style.display = 'none'; // Ensure hidden
                    toggleButtonsContainerCat.appendChild(btn);
                });
            }

            var bounds = L.latLngBounds([]);

            matchingCategories.forEach(function (category) {
                if (layerGroups[category]) {
                    // Collect all features from this category
                    var categoryFeatures = [];
                    layerGroups[category].eachLayer(function (layer) {
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
                            pointToLayer: function (feature, latlng) {
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
                map.fitBounds(bounds, { padding: [50, 50] });
            }

            results = matchingCategories;
        } else {
            // Show no results message
            if (noResultsElement) {
                noResultsElement.style.display = 'block';
            }

            // Hide all category buttons when no results (but keep add-btn visible)
            if (toggleButtonsContainerCat) {
                toggleButtonsContainerCat.querySelectorAll('.toggle-btn').forEach(function (button) {
                    var category = button.getAttribute('data-category');
                    // Only hide buttons with category (not add-btn)
                    if (category) {
                        button.style.display = 'none';
                        button.classList.remove('active');
                    }
                });
            }
        }
    } else {
        // Search by mark (original search logic)
        // First, hide all original layer groups for mark search
        Object.keys(layerGroups).forEach(function (category) {
            if (map.hasLayer(layerGroups[category])) {
                map.removeLayer(layerGroups[category]);
            }
        });

        // Also clear any search result layers from previous searches
        searchResultLayers.forEach(function (layer) {
            if (map.hasLayer(layer)) {
                map.removeLayer(layer);
            }
        });
        searchResultLayers = [];

        // Restore all buttons visibility when searching by mark
        var toggleButtonsContainerMark = document.querySelector('.toggle-buttons');
        if (toggleButtonsContainerMark) {
            toggleButtonsContainerMark.querySelectorAll('.toggle-btn').forEach(function (button) {
                var category = button.getAttribute('data-category');
                // Only restore buttons with category (not add-btn)
                if (category) {
                    button.style.display = '';
                }
            });
        }

        // Restore original button order if needed
        if (toggleButtonsContainerMark && originalButtonOrder.length > 0) {
            var currentButtons = Array.from(toggleButtonsContainerMark.querySelectorAll('.toggle-btn'));
            var categoryButtons = currentButtons.filter(function (btn) {
                return btn.getAttribute('data-category');
            });
            var needsReorder = false;

            // Check if order needs to be restored
            for (var i = 0; i < Math.min(categoryButtons.length, originalButtonOrder.length); i++) {
                if (categoryButtons[i] !== originalButtonOrder[i]) {
                    needsReorder = true;
                    break;
                }
            }

            if (needsReorder) {
                categoryButtons.forEach(function (btn) {
                    if (btn.parentNode === toggleButtonsContainerMark) {
                        toggleButtonsContainerMark.removeChild(btn);
                    }
                });
                originalButtonOrder.forEach(function (btn) {
                    if (btn.parentNode !== toggleButtonsContainerMark) {
                        toggleButtonsContainerMark.appendChild(btn);
                    }
                });
            }
        }

        var searchQuery = query.toLowerCase().trim();
        results = allMarkers.filter(function (marker) {
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
            results.forEach(function (result) {
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
            Object.keys(categoriesToShow).forEach(function (category) {
                if (layerGroups[category]) {
                    // Create a new GeoJSON layer with only matching features
                    var matchingFeatures = results
                        .filter(function (r) { return r.category === category; })
                        .map(function (r) { return r.feature; });

                    if (matchingFeatures.length > 0) {
                        var filteredLayer = L.geoJSON({
                            type: "FeatureCollection",
                            features: matchingFeatures
                        }, {
                            pointToLayer: function (feature, latlng) {
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
                map.fitBounds(bounds, { padding: [50, 50] });
            }
        } else {
            // Show no results message
            if (noResultsElement) {
                noResultsElement.style.display = 'block';
            }

            // Don't restore layers when no results - keep them hidden (same as project 3)
        }
    }

    updateNoCategoryMessage();
    return results;
}

// Wait for DOM to load before binding events
document.addEventListener('DOMContentLoaded', function () {
    // Get toggle buttons container
    var toggleButtonsContainer = document.querySelector('.toggle-buttons');

    // Save original button order for restoration (only category buttons, not add-btn)
    if (toggleButtonsContainer) {
        toggleButtonsContainer.querySelectorAll('.toggle-btn').forEach(function (button) {
            var category = button.getAttribute('data-category');
            // Only save buttons with category (not add-btn)
            if (category) {
                originalButtonOrder.push(button);
            }
        });
    }

    // Categories start unselected/off (no 'active' class, no layer on the
    // map) until the user toggles one on or searches.

    // Bind click events for category buttons only
    if (toggleButtonsContainer) {
        toggleButtonsContainer.querySelectorAll('.toggle-btn').forEach(function (button) {
            var category = button.getAttribute('data-category');
            // Only bind events for buttons with category (not add-btn)
            if (category) {
                button.addEventListener('click', function () {
                    var isActive = this.classList.contains('active');

                    if (isActive) {
                        this.classList.remove('active');
                        toggleLayer(category, false);
                    } else {
                        this.classList.add('active');
                        toggleLayer(category, true);
                    }
                });
            }
        });
    }

    // Bind campus dropdown events
    document.querySelectorAll('.dropdown-content a[data-campus]').forEach(function (link) {
        link.addEventListener('click', function (e) {
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

    // Marker collection for search is initialized once all categories have
    // finished loading from the API (see loadCategory/Promise.all above).

    // Bind search input events
    var searchInput = document.getElementById('searchInput');
    if (searchInput) {
        // Search on input (only if there's actual content)
        searchInput.addEventListener('input', function () {
            var query = this.value;
            var searchMode = document.querySelector('input[name="searchMode"]:checked');
            var mode = searchMode ? searchMode.value : 'mark';
            // Only search if there's actual content, otherwise clear search
            if (query && query.trim() !== '') {
                searchMarkers(query, mode);
            } else {
                searchMarkers('', mode);
            }
        });

        // Also trigger search when search mode changes
        document.querySelectorAll('input[name="searchMode"]').forEach(function (radio) {
            radio.addEventListener('change', function () {
                var query = searchInput.value;
                var mode = this.value;
                // Only search if there's actual content, otherwise clear search
                if (query && query.trim() !== '') {
                    searchMarkers(query, mode);
                } else {
                    searchMarkers('', mode);
                }
            });
        });
    }

    const formCategory = document.getElementById("form-category");
    const labelHall = document.getElementById("label-hall");
    const labelFloor = document.getElementById("label-floor");
    const labelNote = document.getElementById("label-note");
    const inputHall = document.getElementById("form-hall");
    const inputFloor = document.getElementById("form-floor");
    const inputNote = document.getElementById("form-note");

    const formConfigs = {
        study: {
            hallLabel: "Building (Hall):",
            hallPlaceholder: "e.g. Walter Library",
            floorLabel: "Floor(s):",
            floorPlaceholder: "e.g. basement, 2",
            noteLabel: "Note:",
            notePlaceholder: "Optional details (quiet, crowded, etc.)",
            defaultName: "Study Space"
        },
        busstops: {
            hallLabel: "Stop Name:",
            hallPlaceholder: "e.g. Washington Ave & Coffman Union",
            floorLabel: "Routes:",
            floorPlaceholder: "e.g. 121, 122, 123",
            noteLabel: "Note:",
            notePlaceholder: "Optional (e.g. Only weekdays, every 10 min)",
            defaultName: "Bus Stop"
        },
        coffee: {
            hallLabel: "Building (Hall):",
            hallPlaceholder: "e.g. Coffman Memorial Union",
            floorLabel: "Floor:",
            floorPlaceholder: "e.g. 1",
            noteLabel: "Note:",
            notePlaceholder: "e.g. Starbucks, Caribou, etc.",
            defaultName: "Coffee Shop"
        },
        microwaves: {
            hallLabel: "Building (Hall):",
            hallPlaceholder: "e.g. Bruininks Hall",
            floorLabel: "Floor:",
            floorPlaceholder: "e.g. 2",
            noteLabel: "Note:",
            notePlaceholder: "e.g. In lounge, near vending",
            defaultName: "Microwave"
        },
        vending: {
            hallLabel: "Building (Hall):",
            hallPlaceholder: "e.g. Moos Tower",
            floorLabel: "Floor:",
            floorPlaceholder: "e.g. Basement",
            noteLabel: "Note:",
            notePlaceholder: "e.g. Snacks only, drinks only",
            defaultName: "Vending Machine"
        },
        bike: {
            hallLabel: "Nearby building / area:",
            hallPlaceholder: "e.g. Keller Hall entrance",
            floorLabel: "Details:",
            floorPlaceholder: "e.g. Covered rack, 10 spots",
            noteLabel: "Note:",
            notePlaceholder: "Optional",
            defaultName: "Bike Parking"
        },
        bathrooms: {
            hallLabel: "Building (Hall):",
            hallPlaceholder: "e.g. Lind Hall",
            floorLabel: "Floor / room:",
            floorPlaceholder: "e.g. 1st floor, near 110",
            noteLabel: "Note:",
            notePlaceholder: "e.g. All-gender, accessible",
            defaultName: "Bathroom"
        },
        parkinggarages: {
            hallLabel: "Garage / Lot name:",
            hallPlaceholder: "e.g. Washington Avenue Ramp",
            floorLabel: "",
            floorPlaceholder: "",
            noteLabel: "",
            notePlaceholder: "",
            defaultName: "Parking Garage"
    }
    };

    function updateAddFormForCategory(category) {
        if (!labelHall || !labelFloor || !labelNote ||
            !inputHall || !inputFloor || !inputNote) {
            return;
        }

        const cfg = formConfigs[category] || formConfigs.study;

        labelHall.textContent = cfg.hallLabel;
        inputHall.placeholder = cfg.hallPlaceholder;
        if (category === "parkinggarages") {
            labelFloor.style.display = "none";
            inputFloor.style.display = "none";
            labelNote.style.display = "none";
            inputNote.style.display = "none";
        } else {
            labelFloor.style.display = "";
            inputFloor.style.display = "";
            labelNote.style.display = "";
            inputNote.style.display = "";
            labelFloor.textContent = cfg.floorLabel;
            labelNote.textContent = cfg.noteLabel;
            inputFloor.placeholder = cfg.floorPlaceholder;
            inputNote.placeholder = cfg.notePlaceholder;
        }
        inputHall.value = "";
        inputFloor.value = "";
        inputNote.value = "";
    }

    if (formCategory) {
        updateAddFormForCategory(formCategory.value);
        formCategory.addEventListener("change", function () {
            updateAddFormForCategory(this.value);
        });
    }

    let adding = false;
    let clickedCoords = null;

    const addBtn = document.getElementById("add-btn");
    const addForm = document.getElementById("add-form");
    const saveBtn = document.getElementById("save-location");
    const cancelBtn = document.getElementById("cancel-location");
    const addLocationAuthStatus = document.getElementById("add-location-auth-status");
    const addFormUserInfo = document.getElementById("add-form-user-info");

    if (!addBtn || !addForm || !saveBtn || !cancelBtn) return;

    // Submitting a new location requires a signed-in UMN Google account
    // (browsing/search/filters/popups never do — this gate only applies
    // here). The backend independently re-verifies the token and the
    // @umn.edu domain on every POST /api/submissions — this is UX only.
    let currentFirebaseUser = null; // { email, displayName } or null
    let wantsToAddAfterSignIn = false;

    function setAddLocationAuthStatus(message) {
        if (!addLocationAuthStatus) return;
        addLocationAuthStatus.textContent = message || "";
        addLocationAuthStatus.style.display = message ? "block" : "none";
    }

    function renderSignedInAs(user) {
        if (addFormUserInfo) {
            if (user) {
                addFormUserInfo.style.display = "block";
                addFormUserInfo.innerHTML = "Signed in as " + (user.displayName || user.email) +
                    " (" + user.email + ") &middot; <a href=\"#\" id=\"add-form-sign-out\">Sign out</a>";
                var signOutLink = document.getElementById("add-form-sign-out");
                if (signOutLink) {
                    signOutLink.addEventListener("click", function (e) {
                        e.preventDefault();
                        window.firebaseSignOut().catch(function (err) {
                            console.error("Sign-out failed:", err);
                        });
                    });
                }
            } else {
                addFormUserInfo.style.display = "none";
                addFormUserInfo.innerHTML = "";
            }
        }
    }

    document.addEventListener("firebase-auth-changed", function (e) {
        var detail = e.detail || {};
        if (detail.signedIn) {
            currentFirebaseUser = { email: detail.email, displayName: detail.displayName };
            setAddLocationAuthStatus("");
            renderSignedInAs(currentFirebaseUser);
            if (wantsToAddAfterSignIn) {
                wantsToAddAfterSignIn = false;
                beginAddingLocation();
            }
        } else {
            currentFirebaseUser = null;
            renderSignedInAs(null);
            if (detail.error) {
                setAddLocationAuthStatus(detail.error);
            }
        }
    });

    function beginAddingLocation() {
        adding = !adding;
        if (adding) {
            addBtn.innerHTML = "Click map to choose location";
            addBtn.classList.add("adding");
            document.getElementById("map").classList.add("map-adding");
        } else {
            addBtn.innerHTML = '<i class="fas fa-plus"></i> Add Location';
            addBtn.classList.remove("adding");
            document.getElementById("map").classList.remove("map-adding");
            addForm.classList.add("hidden");
        }
    }

    addBtn.addEventListener("click", function () {
        if (!currentFirebaseUser) {
            wantsToAddAfterSignIn = true;
            setAddLocationAuthStatus("Sign in with your UMN Google account to add a location…");
            window.firebaseSignIn().catch(function (err) {
                wantsToAddAfterSignIn = false;
                console.error("Sign-in failed:", err);
                setAddLocationAuthStatus("Sign-in failed: " + err.message);
            });
            return;
        }
        beginAddingLocation();
    });

    map.on("click", function (e) {
        if (!adding) return;
        clickedCoords = e.latlng;
        addForm.style.display = "block";
        addForm.classList.remove("hidden");
        addForm.scrollIntoView({ behavior: "smooth", block: "center" });
    });

    saveBtn.addEventListener("click", function () {
        if (!clickedCoords || !formCategory) {
            return;
        }

        var category = formCategory.value;
        var field1 = inputHall ? inputHall.value || "" : "";
        var field2 = inputFloor ? inputFloor.value || "" : "";
        var note = inputNote ? inputNote.value || "" : "";
        var iconOrColor = markerColors[category] || "#808080";
        var cfg = formConfigs[category] || formConfigs.study;

        var properties = {};

        if (category === "parkinggarages") {
            properties.name = field1 || cfg.defaultName || "Parking Garage";
        } else {
            properties.name = cfg.defaultName || "Location";
            if (category === "study") {
                properties.hall = field1 || "Unknown";
                properties.floor = field2 || "N/A";
            } else if (category === "busstops") {
                properties.stop = field1 || "Unknown stop";
                properties.route = field2 || "N/A";
            } else {
                properties.hall = field1 || "Unknown";
                properties.floor = field2 || "N/A";
            }
            if (note) {
                properties.note = note;
            }
        }

        // Capture the coordinates for this submission now — clickedCoords
        // could change if the user clicks the map again while this request
        // is still in flight (the form stays open on failure, so that's
        // possible).
        var submittedCoords = clickedCoords;

        var body = {
            category: category,
            lat: submittedCoords.lat,
            lng: submittedCoords.lng,
            properties: properties
        };

        var submitErrorEl = document.getElementById("submit-error");
        if (submitErrorEl) {
            submitErrorEl.style.display = "none";
            submitErrorEl.textContent = "";
        }
        saveBtn.disabled = true;
        var originalSaveLabel = saveBtn.textContent;
        saveBtn.textContent = "Saving...";

        var submitUrl = API_BASE + "/api/submissions";
        window.getFirebaseAuthHeader()
            .then(function (authHeader) {
                var headers = { "Content-Type": "application/json" };
                for (var key in authHeader) headers[key] = authHeader[key];
                return fetch(submitUrl, {
                    method: "POST",
                    headers: headers,
                    body: JSON.stringify(body)
                });
            })
            .then(function (res) {
                if (!res.ok) {
                    throw new Error("HTTP " + res.status);
                }
                return res.json();
            })
            .then(function () {
                // Only now — a confirmed 2xx response — do we render the
                // optimistic marker, show the thank-you banner, and close
                // and reset the form.
                var feature = {
                    type: "Feature",
                    properties: properties,
                    geometry: {
                        type: "Point",
                        coordinates: [submittedCoords.lng, submittedCoords.lat]
                    }
                };

                var marker = createCustomMarker(feature, submittedCoords, iconOrColor);
                onEachFeature(feature, marker);
                if (layerGroups[category]) {
                    marker.addTo(layerGroups[category]);
                } else {
                    marker.addTo(map);
                }

                var msg = document.getElementById("submission-message");
                if (msg) {
                    msg.style.display = "block";
                    setTimeout(function () {
                        msg.style.display = "none";
                    }, 5000);
                }

                addForm.classList.add("hidden");
                addBtn.innerHTML = '<i class="fas fa-plus"></i> Add Location';
                addBtn.classList.remove("adding");
                document.getElementById("map").classList.remove("map-adding");
                adding = false;
                clickedCoords = null;

                if (inputHall) inputHall.value = "";
                if (inputFloor) inputFloor.value = "";
                if (inputNote) inputNote.value = "";
            })
            .catch(function (err) {
                console.error("Failed to submit location to " + submitUrl + ":", err);
                // Form stays open, fields stay filled in, adding/clickedCoords
                // are untouched — the user can just click Save again.
                if (submitErrorEl) {
                    submitErrorEl.textContent = "Couldn't submit this location (" + err.message + "). Please try again.";
                    submitErrorEl.style.display = "block";
                }
            })
            .finally(function () {
                saveBtn.disabled = false;
                saveBtn.textContent = originalSaveLabel;
            });
    });

    cancelBtn.addEventListener("click", function () {
        addForm.classList.add("hidden");
        addBtn.innerHTML = '<i class="fas fa-plus"></i> Add Location';
        addBtn.classList.remove("adding");
        document.getElementById("map").classList.remove("map-adding");
        adding = false;
    });
});
