package main

import (
	"database/sql"
	"encoding/json"
	"log"
	"net/http"

	_ "github.com/lib/pq"
)

type Submission struct {
	Category string  `json:"category"`
	Name     string  `json:"name"`
	Hall     string  `json:"hall"`
	Floor    string  `json:"floor"`
	Note     string  `json:"note"`
	Lat      float64 `json:"lat"`
	Lon      float64 `json:"lon"`
}

var db *sql.DB

func main() {
	connStr := "host=localhost port=5432 user=postgres password=Nadroj123! dbname=umn_map sslmode=disable"

	var err error
	db, err = sql.Open("postgres", connStr)
	if err != nil {
		log.Fatal("sql.Open error:", err)
	}
	if err = db.Ping(); err != nil {
		log.Fatal("db.Ping error:", err)
	}

	http.HandleFunc("/api/submissions", submissionsHandler)

	http.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Write([]byte("ok"))
	})

	log.Println("server listening on :8080")
	log.Fatal(http.ListenAndServe(":8080", nil))
}

func submissionsHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
	w.Header().Set("Access-Control-Allow-Methods", "POST, OPTIONS")

	if r.Method == http.MethodOptions {
		w.WriteHeader(http.StatusNoContent)
		return
	}

	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var s Submission
	if err := json.NewDecoder(r.Body).Decode(&s); err != nil {
		log.Println("decode error:", err)
		http.Error(w, "bad request", http.StatusBadRequest)
		return
	}

	query := `
		INSERT INTO pending_locations (category, name, hall, floor, note, lat, lng)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
		RETURNING id;
	`
	var id int
	err := db.QueryRow(query,
		s.Category, s.Name, s.Hall, s.Floor, s.Note, s.Lat, s.Lon,
	).Scan(&id)

	if err != nil {
		log.Println("insert error:", err)
		http.Error(w, "db error", http.StatusInternalServerError)
		return
	}

	log.Println("inserted submission id", id)

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(map[string]any{"id": id})
}
