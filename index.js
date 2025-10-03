var map = L.map('map').setView([44.9740, -93.2354], 15.5);
L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
}).addTo(map);

function onEachFeature(feature, layer) {
    if (feature.properties && feature.properties.name && feature.properties.floor && feature.properties.hall) {
        layer.bindPopup(feature.properties.name.concat("<br>Building: ", feature.properties.hall.concat("<br>Floor: ", feature.properties.floor)));
    }
}

// when adding a new set of objects, copy the following line and change test to your variable
L.geoJSON(test).addTo(map);
L.geoJSON(coffee, {
    onEachFeature: onEachFeature
}).addTo(map);
L.geoJSON(vending, {
    onEachFeature: onEachFeature
}).addTo(map);