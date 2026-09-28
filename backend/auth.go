package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"strings"

	firebase "firebase.google.com/go/v4"
	"firebase.google.com/go/v4/auth"
	"google.golang.org/api/option"
)

// newFirebaseAuthClient initializes the Firebase Admin SDK. Credentials come
// from FIREBASE_SERVICE_ACCOUNT_JSON (the service account key content) if
// set, otherwise from the default credential chain (e.g.
// GOOGLE_APPLICATION_CREDENTIALS pointing at a key file). The Admin SDK only
// runs here, server-side — it never ships to the browser.
func newFirebaseAuthClient(ctx context.Context) (*auth.Client, error) {
	var opts []option.ClientOption
	if key := os.Getenv("FIREBASE_SERVICE_ACCOUNT_JSON"); key != "" {
		opts = append(opts, option.WithCredentialsJSON([]byte(key)))
	}

	config := &firebase.Config{ProjectID: os.Getenv("FIREBASE_PROJECT_ID")}
	app, err := firebase.NewApp(ctx, config, opts...)
	if err != nil {
		return nil, err
	}

	return app.Auth(ctx)
}

type contextKey string

const adminUIDKey contextKey = "adminUID"

// requireAdmin wraps a handler so it only runs for requests carrying a valid
// Firebase ID token whose custom claims include admin=true. The claim is
// granted out-of-band (Firebase console or a one-off Admin SDK script), never
// through an app-facing endpoint. The verified caller's UID is stashed in the
// request context so handlers can record who reviewed a submission.
func requireAdmin(authClient *auth.Client, next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		header := r.Header.Get("Authorization")
		idToken, ok := strings.CutPrefix(header, "Bearer ")
		if !ok || idToken == "" {
			http.Error(w, "missing bearer token", http.StatusUnauthorized)
			return
		}

		token, err := authClient.VerifyIDToken(r.Context(), idToken)
		if err != nil {
			log.Println("token verification failed:", err)
			http.Error(w, "invalid or expired token", http.StatusUnauthorized)
			return
		}

		isAdmin, _ := token.Claims["admin"].(bool)
		if !isAdmin {
			http.Error(w, "admin access required", http.StatusForbidden)
			return
		}

		ctx := context.WithValue(r.Context(), adminUIDKey, token.UID)
		next(w, r.WithContext(ctx))
	}
}
