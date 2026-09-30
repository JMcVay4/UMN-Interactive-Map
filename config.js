// API base URL for the Go backend. This is a plain URL, not a secret — safe
// to ship in client-side JS. No build step is involved in this project, so
// environment switching is done by hostname instead of an env var:
// localhost/127.0.0.1 (local dev) hits the Go server on :8080; anything else
// (e.g. umn-campus-map.web.app) hits the deployed Render backend.
const API_BASE =
  window.location.hostname === "localhost" ||
  window.location.hostname === "127.0.0.1"
    ? "http://localhost:8080"
    : "https://umn-campus-map-api.onrender.com";
