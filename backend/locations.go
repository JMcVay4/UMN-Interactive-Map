package main

import (
	"database/sql"
	"encoding/json"
	"log"
	"net/http"
	"strconv"
	"time"
)

var validStatuses = map[string]bool{"pending": true, "approved": true, "rejected": true}

type geoJSONPoint struct {
	Type        string     `json:"type"`
	Coordinates [2]float64 `json:"coordinates"`
}

type geoJSONFeature struct {
	Type       string          `json:"type"`
	ID         int64           `json:"id"`
	Properties json.RawMessage `json:"properties"`
	Geometry   geoJSONPoint    `json:"geometry"`
}

type geoJSONFeatureCollection struct {
	Type     string           `json:"type"`
	Features []geoJSONFeature `json:"features"`
}

func getLocationsHandler(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		query := `SELECT id, category, lat, lng, properties FROM locations WHERE status = 'approved'`
		args := []any{}

		if category := r.URL.Query().Get("category"); category != "" {
			query += ` AND category = $1`
			args = append(args, category)
		}
		query += ` ORDER BY id`

		rows, err := db.Query(query, args...)
		if err != nil {
			log.Println("query error:", err)
			http.Error(w, "db error", http.StatusInternalServerError)
			return
		}
		defer rows.Close()

		collection := geoJSONFeatureCollection{Type: "FeatureCollection", Features: []geoJSONFeature{}}
		for rows.Next() {
			var id int64
			var category string
			var lat, lng float64
			var properties []byte
			if err := rows.Scan(&id, &category, &lat, &lng, &properties); err != nil {
				log.Println("scan error:", err)
				http.Error(w, "db error", http.StatusInternalServerError)
				return
			}
			collection.Features = append(collection.Features, geoJSONFeature{
				Type:       "Feature",
				ID:         id,
				Properties: properties,
				Geometry:   geoJSONPoint{Type: "Point", Coordinates: [2]float64{lng, lat}},
			})
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(collection)
	}
}

type submissionRequest struct {
	Category   string         `json:"category"`
	Lat        float64        `json:"lat"`
	Lng        float64        `json:"lng"`
	Properties map[string]any `json:"properties"`
}

func createSubmissionHandler(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var req submissionRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, "bad request", http.StatusBadRequest)
			return
		}

		if req.Category == "" {
			http.Error(w, "category is required", http.StatusBadRequest)
			return
		}
		if req.Lat < -90 || req.Lat > 90 || req.Lng < -180 || req.Lng > 180 {
			http.Error(w, "lat/lng out of range", http.StatusBadRequest)
			return
		}
		if req.Properties == nil {
			req.Properties = map[string]any{}
		}

		propsJSON, err := json.Marshal(req.Properties)
		if err != nil {
			http.Error(w, "invalid properties", http.StatusBadRequest)
			return
		}

		var id int64
		err = db.QueryRow(
			`INSERT INTO locations (category, lat, lng, properties, status)
			 VALUES ($1, $2, $3, $4, 'pending') RETURNING id`,
			req.Category, req.Lat, req.Lng, string(propsJSON),
		).Scan(&id)
		if err != nil {
			log.Println("insert error:", err)
			http.Error(w, "db error", http.StatusInternalServerError)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusCreated)
		json.NewEncoder(w).Encode(map[string]any{"id": id, "status": "pending"})
	}
}

type submissionRow struct {
	ID          int64           `json:"id"`
	Category    string          `json:"category"`
	Lat         float64         `json:"lat"`
	Lng         float64         `json:"lng"`
	Properties  json.RawMessage `json:"properties"`
	Status      string          `json:"status"`
	SubmittedBy *string         `json:"submittedBy"`
	ReviewedBy  *string         `json:"reviewedBy"`
	ReviewedAt  *time.Time      `json:"reviewedAt"`
	CreatedAt   time.Time       `json:"createdAt"`
}

func listSubmissionsHandler(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		status := r.URL.Query().Get("status")
		if status == "" {
			status = "pending"
		}
		if !validStatuses[status] {
			http.Error(w, "invalid status", http.StatusBadRequest)
			return
		}

		rows, err := db.Query(
			`SELECT id, category, lat, lng, properties, status, submitted_by, reviewed_by, reviewed_at, created_at
			 FROM locations WHERE status = $1 ORDER BY created_at ASC`,
			status,
		)
		if err != nil {
			log.Println("query error:", err)
			http.Error(w, "db error", http.StatusInternalServerError)
			return
		}
		defer rows.Close()

		results := []submissionRow{}
		for rows.Next() {
			var s submissionRow
			var properties []byte
			var submittedBy, reviewedBy sql.NullString
			var reviewedAt sql.NullTime
			if err := rows.Scan(&s.ID, &s.Category, &s.Lat, &s.Lng, &properties, &s.Status,
				&submittedBy, &reviewedBy, &reviewedAt, &s.CreatedAt); err != nil {
				log.Println("scan error:", err)
				http.Error(w, "db error", http.StatusInternalServerError)
				return
			}
			s.Properties = properties
			if submittedBy.Valid {
				s.SubmittedBy = &submittedBy.String
			}
			if reviewedBy.Valid {
				s.ReviewedBy = &reviewedBy.String
			}
			if reviewedAt.Valid {
				s.ReviewedAt = &reviewedAt.Time
			}
			results = append(results, s)
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(results)
	}
}

func reviewSubmissionHandler(db *sql.DB, newStatus string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id, err := strconv.ParseInt(r.PathValue("id"), 10, 64)
		if err != nil {
			http.Error(w, "invalid id", http.StatusBadRequest)
			return
		}

		adminUID, _ := r.Context().Value(adminUIDKey).(string)

		result, err := db.Exec(
			`UPDATE locations SET status = $1, reviewed_by = $2, reviewed_at = now()
			 WHERE id = $3 AND status = 'pending'`,
			newStatus, adminUID, id,
		)
		if err != nil {
			log.Println("update error:", err)
			http.Error(w, "db error", http.StatusInternalServerError)
			return
		}

		rowsAffected, _ := result.RowsAffected()
		if rowsAffected == 0 {
			http.Error(w, "submission not found or already reviewed", http.StatusNotFound)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]any{"id": id, "status": newStatus})
	}
}
