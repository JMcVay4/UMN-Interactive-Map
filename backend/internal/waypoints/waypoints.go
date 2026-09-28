// Package waypoints parses the repo's legacy waypoints/*.js files and
// imports them into the locations table. Shared by cmd/migrate-waypoints
// (standalone binary) and main's -import-waypoints flag.
package waypoints

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"runtime"
	"sort"
)

var files = map[string]string{
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

type Feature struct {
	Properties map[string]any `json:"properties"`
	Geometry   struct {
		Coordinates []float64 `json:"coordinates"` // [lng, lat]
	} `json:"geometry"`
}

type featureCollection struct {
	Features []Feature `json:"features"`
}

// DefaultDir resolves the repo's waypoints/ folder relative to this source
// file, regardless of the caller's working directory.
func DefaultDir() string {
	_, thisFile, _, _ := runtime.Caller(0)
	return filepath.Join(filepath.Dir(thisFile), "..", "..", "..", "waypoints")
}

// LoadFeatures reads and parses every known waypoints/*.js file, keyed by category.
func LoadFeatures(dir string) (map[string][]Feature, error) {
	result := make(map[string][]Feature)

	for filename, category := range files {
		path := filepath.Join(dir, filename)
		raw, err := os.ReadFile(path)
		if err != nil {
			return nil, fmt.Errorf("reading %s: %w", path, err)
		}

		jsonBytes := jsAssignmentPrefix.ReplaceAll(raw, nil)
		jsonBytes = trimTrailingSemicolon(jsonBytes)
		jsonBytes = blockComment.ReplaceAll(jsonBytes, nil)
		jsonBytes = trailingComma.ReplaceAll(jsonBytes, []byte("$1"))

		var collection featureCollection
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

// PrintSummary prints per-category and total feature counts, sorted by
// category name, and returns the total.
func PrintSummary(features map[string][]Feature) int {
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
	return total
}

// Import replaces all previously-seeded rows (source = 'seed') with a fresh
// insert of the given features, atomically. Rows with source = 'submission'
// (the default for everything POST /api/submissions creates) are never
// touched.
func Import(db *sql.DB, features map[string][]Feature) error {
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
