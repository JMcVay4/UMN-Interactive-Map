var map = L.map('map').setView([44.9740, -93.2354], 15.5);
L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
}).addTo(map);

L.geoJSON(test).addTo(map);

//test