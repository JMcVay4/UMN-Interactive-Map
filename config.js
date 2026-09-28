// API base URL for the Go backend. This is a plain URL, not a secret — safe
// to ship in client-side JS. Change this one line to switch environments;
// no build step is involved in this project.
//
// Local development (default): the Go server running on your machine
// (`go run .` from backend/, listening on :8080 by default).
//
// Production: once the backend is deployed to Render, replace this with its
// real URL, e.g.
//   const API_BASE = "https://umn-interactive-map-backend.onrender.com";
const API_BASE = "http://localhost:8080";
