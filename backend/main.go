package main

import (
	"context"
	"flag"
	"fmt"
	"log"
	"net/http"
	"os"

	"github.com/joho/godotenv"

	"umn-interactive-map-backend/internal/waypoints"
)

func main() {
	importWaypoints := flag.Bool("import-waypoints", false, "import waypoints/*.js into Postgres and exit, instead of starting the server")
	flag.Parse()

	if err := godotenv.Load(); err != nil {
		log.Println("no .env file found, relying on real environment variables")
	}

	db, err := openDB()
	if err != nil {
		log.Fatal("database setup error:", err)
	}
	defer db.Close()

	if *importWaypoints {
		features, err := waypoints.LoadFeatures(waypoints.DefaultDir())
		if err != nil {
			log.Fatal("failed to load waypoint files:", err)
		}
		waypoints.PrintSummary(features)
		if err := waypoints.Import(db, features); err != nil {
			log.Fatal("import failed:", err)
		}
		fmt.Println("import complete")
		return
	}

	ctx := context.Background()
	authClient, err := newFirebaseAuthClient(ctx)
	if err != nil {
		log.Println("warning: firebase auth not configured, /api/admin/* will return 503:", err)
		authClient = nil
	}

	mux := http.NewServeMux()

	mux.HandleFunc("GET /api/locations", getLocationsHandler(db))
	mux.HandleFunc("POST /api/submissions", createSubmissionHandler(db))
	mux.HandleFunc("GET /api/admin/submissions", requireAdmin(authClient, listSubmissionsHandler(db)))
	mux.HandleFunc("POST /api/admin/submissions/{id}/approve", requireAdmin(authClient, reviewSubmissionHandler(db, "approved")))
	mux.HandleFunc("POST /api/admin/submissions/{id}/reject", requireAdmin(authClient, reviewSubmissionHandler(db, "rejected")))

	mux.HandleFunc("GET /health", func(w http.ResponseWriter, r *http.Request) {
		w.Write([]byte("ok"))
	})

	allowedOrigin := os.Getenv("ALLOWED_ORIGIN")
	if allowedOrigin == "" {
		allowedOrigin = "*"
		log.Println("warning: ALLOWED_ORIGIN not set, defaulting to * (fine for local dev only)")
	}

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	log.Println("server listening on :" + port)
	log.Fatal(http.ListenAndServe(":"+port, withCORS(allowedOrigin, mux)))
}
