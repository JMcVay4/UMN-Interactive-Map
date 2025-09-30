// Constructor for microwaves
function Microwave(x, y, floor, hall, room) {
    this.x = x;
    this.y = y;
    this.floor = floor;
    this.hall = hall;
    this.room = room;
}

const mw1 = new Microwave(44.9741, -93.2372, 2, "Bruinincks", "Basement");


var map = L.map('map').setView([44.9740, -93.2354], 15.5);
L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
}).addTo(map);
L.marker([mw1.x, mw1.y]).addTo(map)
    .bindPopup()
    .openPopup();