// Command migrate-waypoints loads waypoints/*.js into the locations table.
//
//	go run ./cmd/migrate-waypoints
//	go run ./cmd/migrate-waypoints -dry-run
//
// Safe to re-run: only replaces rows with source='seed', never
// source='submission' rows (real user submissions).
package main

import (
	"database/sql"
	"flag"
	"fmt"
	"log"
	"os"

	"github.com/joho/godotenv"
	_ "github.com/lib/pq"

	"umn-interactive-map-backend/internal/waypoints"
)

func main() {
	dir := flag.String("dir", waypoints.DefaultDir(), "directory containing the waypoints/*.js files")
	dryRun := flag.Bool("dry-run", false, "parse and report counts without writing to the database")
	flag.Parse()

	if err := godotenv.Load(); err != nil {
		log.Println("no .env file found, relying on real environment variables")
	}

	features, err := waypoints.LoadFeatures(*dir)
	if err != nil {
		log.Fatal("failed to load waypoint files:", err)
	}
	waypoints.PrintSummary(features)

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

	if err := waypoints.Import(db, features); err != nil {
		log.Fatal("import failed:", err)
	}
	fmt.Println("import complete")
}
