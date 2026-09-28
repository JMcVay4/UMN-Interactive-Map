package main

import (
	"context"
	"log"
	"net/http"
	"os"

	"github.com/joho/godotenv"
)

func main() {
	if err := godotenv.Load(); err != nil {
		log.Println("no .env file found, relying on real environment variables")
	}

	db, err := openDB()
	if err != nil {
		log.Fatal("database setup error:", err)
	}
	defer db.Close()

	ctx := context.Background()
	authClient, err := newFirebaseAuthClient(ctx)
	if err != nil {
		log.Fatal("firebase auth setup error:", err)
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
