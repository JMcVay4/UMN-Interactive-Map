package main

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"os"
	"strings"

	firebase "firebase.google.com/go/v4"
	"firebase.google.com/go/v4/auth"
	"google.golang.org/api/option"
)

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

// grantAdmin sets the admin=true custom claim on an existing Firebase user
// found by email, preserving any other custom claims already set.
func grantAdmin(ctx context.Context, authClient *auth.Client, rawEmail string) error {
	email := strings.TrimSpace(rawEmail)
	if !strings.HasSuffix(strings.ToLower(email), "@umn.edu") {
		return fmt.Errorf("refusing to grant admin: %q does not end in @umn.edu", email)
	}

	user, err := authClient.GetUserByEmail(ctx, email)
	if err != nil {
		return fmt.Errorf("no existing Firebase user with email %q: %w", email, err)
	}

	claims := map[string]interface{}{}
	for k, v := range user.CustomClaims {
		claims[k] = v
	}
	claims["admin"] = true

	if err := authClient.SetCustomUserClaims(ctx, user.UID, claims); err != nil {
		return fmt.Errorf("failed to set admin claim: %w", err)
	}

	fmt.Printf("granted admin=true to %s (uid: %s)\n", user.Email, user.UID)
	return nil
}

type contextKey string

const adminUIDKey contextKey = "adminUID"
const submitterUIDKey contextKey = "submitterUID"

// verifyRequestToken extracts and verifies the bearer token from the
// request. On failure it writes the appropriate error response itself and
// returns ok=false; callers should just return in that case.
func verifyRequestToken(authClient *auth.Client, w http.ResponseWriter, r *http.Request) (*auth.Token, bool) {
	if authClient == nil {
		http.Error(w, "authentication is not configured on this server", http.StatusServiceUnavailable)
		return nil, false
	}

	header := r.Header.Get("Authorization")
	idToken, ok := strings.CutPrefix(header, "Bearer ")
	if !ok || idToken == "" {
		http.Error(w, "missing bearer token", http.StatusUnauthorized)
		return nil, false
	}

	token, err := authClient.VerifyIDToken(r.Context(), idToken)
	if err != nil {
		log.Println("token verification failed:", err)
		http.Error(w, "invalid or expired token", http.StatusUnauthorized)
		return nil, false
	}

	return token, true
}

// requireAdmin passes requests through only if the bearer token is a valid
// Firebase ID token with an admin=true custom claim.
func requireAdmin(authClient *auth.Client, next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		token, ok := verifyRequestToken(authClient, w, r)
		if !ok {
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

// requireUMNUser passes requests through only if the bearer token is a
// valid Firebase ID token for an @umn.edu account. It does NOT require the
// admin claim — this gates regular location submissions, not moderation.
func requireUMNUser(authClient *auth.Client, next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		token, ok := verifyRequestToken(authClient, w, r)
		if !ok {
			return
		}

		email, _ := token.Claims["email"].(string)
		if !strings.HasSuffix(strings.ToLower(email), "@umn.edu") {
			http.Error(w, "a UMN (@umn.edu) account is required", http.StatusForbidden)
			return
		}

		ctx := context.WithValue(r.Context(), submitterUIDKey, token.UID)
		next(w, r.WithContext(ctx))
	}
}
