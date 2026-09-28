// Command migrate-waypoints loads waypoints/*.js into the locations table.
//
//	go run ./cmd/migrate-waypoints
//	go run ./cmd/migrate-waypoints -dry-run
//
// Safe to re-run: only replaces rows with source='seed', never
// source='submission' rows (real user submissions).
package main

import (
	"context"
	"database/sql"
	"encoding/json"
	"flag"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"regexp"
	"runtime"
	"sort"

	"github.com/joho/godotenv"
	_ "github.com/lib/pq"
)

var waypointFiles = map[string]string{
	"bathrooms.js":      "bathrooms",
	"bike.js":           "bike",
	"busstops.js":       "busstops",
	"coffee.js":         "coffee",
	"microwaves1.js":    "microwaves",
	"parkinggarages.js": "parkinggarages",
	"study.js":          "study",
	"vending.js":        "vending",
}

var jsAssignmentPrefix = regexp.MustCompile(`(?s)^\s*var\s+[A-Za-z0-9_]+\s*=\s*`)
var trailingComma = regexp.MustCompile(`,(\s*[}\]])`) // valid in JS, not in strict JSON
var blockComment = regexp.MustCompile(`(?s)/\*.*?\*/`)

type waypointFeatureCollection struct {
	Features []waypointFeature `json:"features"`
}

type waypointFeature struct {
	Properties map[string]any `json:"properties"`
	Geometry   struct {
		Coordinates []float64 `json:"coordinates"` // [lng, lat]
	} `json:"geometry"`
}

func defaultWaypointsDir() string {
	_, thisFile, _, _ := runtime.Caller(0)
	return filepath.Join(filepath.Dir(thisFile), "..", "..", "..", "waypoints")
}

func main() {
	dir := flag.String("dir", defaultWaypointsDir(), "directory containing the waypoints/*.js files")
	dryRun := flag.Bool("dry-run", false, "parse and report counts without writing to the database")
	flag.Parse()

	if err := godotenv.Load(); err != nil {
		log.Println("no .env file found, relying on real environment variables")
	}

	features, err := loadWaypointFeatures(*dir)
	if err != nil {
		log.Fatal("failed to load waypoint files:", err)
	}

	total := 0
	names := make([]string, 0, len(features))
	for category := range features {
		names = append(names, category)
	}
	sort.Strings(names)
	for _, category := range names {
		count := len(features[category])
		total += count
		fmt.Printf("  %-16s %d features\n", category, count)
	}
	fmt.Printf("total: %d features across %d categories\n", total, len(names))

	if *dryRun {
		fmt.Println("dry run: no database changes made")
		return
	}

	connStr := os.Getenv("DATABASE_URL")
	if connStr == "" {
		connStr = "postgres://postgres:postgres@localhost:5432/umn_map?sslmode=disable"
	}
	db, err := sql.Open("postgres", connStr)
	if err != nil {
		log.Fatal("sql.Open error:", err)
	}
	defer db.Close()
	if err := db.Ping(); err != nil {
		log.Fatal("db.Ping error:", err)
	}

	if err := importFeatures(db, features); err != nil {
		log.Fatal("import failed:", err)
	}
	fmt.Println("import complete")
}

func loadWaypointFeatures(dir string) (map[string][]waypointFeature, error) {
	result := make(map[string][]waypointFeature)

	for filename, category := range waypointFiles {
		path := filepath.Join(dir, filename)
		raw, err := os.ReadFile(path)
		if err != nil {
			return nil, fmt.Errorf("reading %s: %w", path, err)
		}

		jsonBytes := jsAssignmentPrefix.ReplaceAll(raw, nil)
		jsonBytes = trimTrailingSemicolon(jsonBytes)
		jsonBytes = blockComment.ReplaceAll(jsonBytes, nil)
		jsonBytes = trailingComma.ReplaceAll(jsonBytes, []byte("$1"))

		var collection waypointFeatureCollection
		if err := json.Unmarshal(jsonBytes, &collection); err != nil {
			return nil, fmt.Errorf("parsing %s: %w", path, err)
		}

		result[category] = collection.Features
	}

	return result, nil
}

func trimTrailingSemicolon(b []byte) []byte {
	end := len(b)
	for end > 0 && (b[end-1] == '\n' || b[end-1] == '\r' || b[end-1] == ' ' || b[end-1] == '\t') {
		end--
	}
	if end > 0 && b[end-1] == ';' {
		end--
	}
	return b[:end]
}

func importFeatures(db *sql.DB, features map[string][]waypointFeature) error {
	ctx := context.Background()
	tx, err := db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()

	if _, err := tx.ExecContext(ctx, `DELETE FROM locations WHERE source = 'seed'`); err != nil {
		return fmt.Errorf("clearing previously seeded rows: %w", err)
	}

	stmt, err := tx.PrepareContext(ctx, `
		INSERT INTO locations (category, lat, lng, properties, status, source, submitted_by)
		VALUES ($1, $2, $3, $4, 'approved', 'seed', NULL)
	`)
	if err != nil {
		return err
	}
	defer stmt.Close()

	for category, categoryFeatures := range features {
		for _, feature := range categoryFeatures {
			if len(feature.Geometry.Coordinates) < 2 {
				return fmt.Errorf("feature in %s missing coordinates: %+v", category, feature)
			}
			lng, lat := feature.Geometry.Coordinates[0], feature.Geometry.Coordinates[1]

			propsJSON, err := json.Marshal(feature.Properties)
			if err != nil {
				return fmt.Errorf("marshaling properties for %s: %w", category, err)
			}

			if _, err := stmt.ExecContext(ctx, category, lat, lng, string(propsJSON)); err != nil {
				return fmt.Errorf("inserting %s feature: %w", category, err)
			}
		}
	}

	return tx.Commit()
}
