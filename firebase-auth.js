import { initializeApp } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";

// Public client config (not a secret) from the Firebase console.
const firebaseConfig = {
  apiKey: "AIzaSyAPwXDIefAf9ML0hHc6bXVYWJuc9zEdOlw",
  authDomain: "umn-campus-map.firebaseapp.com",
  projectId: "umn-campus-map",
  storageBucket: "umn-campus-map.firebasestorage.app",
  messagingSenderId: "520433045231",
  appId: "1:520433045231:web:95adca7048588f5364d51a"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

const provider = new GoogleAuthProvider();
provider.setCustomParameters({ hd: "umn.edu" });

// admin.html-specific elements. Guarded everywhere below since they don't
// exist on index.html — this file is shared by both pages.
const signInBtn = document.getElementById("admin-sign-in");
const signOutBtn = document.getElementById("admin-sign-out");
const userInfo = document.getElementById("admin-user-info");
const statusEl = document.getElementById("admin-status");

function setStatus(message, isError) {
  if (!statusEl) return;
  statusEl.textContent = message || "";
  statusEl.classList.toggle("error", !!isError);
}

// Shared sign-in/out entry points so any page can trigger Google auth
// without needing admin.html's specific button elements.
window.firebaseSignIn = function () {
  return signInWithPopup(auth, provider);
};

window.firebaseSignOut = function () {
  return signOut(auth);
};

if (signInBtn) {
  signInBtn.addEventListener("click", function () {
    setStatus("");
    window.firebaseSignIn().catch(function (err) {
      console.error("Google sign-in failed:", err);
      setStatus("Sign-in failed: " + err.message, true);
    });
  });
}

if (signOutBtn) {
  signOutBtn.addEventListener("click", function () {
    window.firebaseSignOut().catch(function (err) {
      console.error("Sign-out failed:", err);
    });
  });
}

// Broadcast on document so any page's own script can react without this
// file needing to know about that page's specific UI.
function broadcastAuthState(detail) {
  document.dispatchEvent(new CustomEvent("firebase-auth-changed", { detail: detail }));
}

onAuthStateChanged(auth, function (user) {
  if (!user) {
    if (signInBtn) signInBtn.hidden = false;
    if (signOutBtn) signOutBtn.hidden = true;
    if (userInfo) userInfo.hidden = true;
    broadcastAuthState({ signedIn: false, isAdmin: false, email: null, displayName: null, error: null });
    return;
  }

  // setCustomParameters({hd: "umn.edu"}) only hints the Google account
  // picker — it is not enforced, so this check is required for UX. It is
  // NOT the security boundary: the backend still requires a valid Firebase
  // ID token (and, for admin routes, the admin custom claim) on every
  // protected request.
  var email = user.email || "";
  if (!email.toLowerCase().endsWith("@umn.edu")) {
    var domainError = "A UMN Google account (@umn.edu) is required.";
    setStatus(domainError, true);
    broadcastAuthState({ signedIn: false, isAdmin: false, email: null, displayName: null, error: domainError });
    window.firebaseSignOut().catch(function (err) {
      console.error("Sign-out after domain check failed:", err);
    });
    return;
  }

  setStatus("");
  if (signInBtn) signInBtn.hidden = true;
  if (signOutBtn) signOutBtn.hidden = false;

  // Custom claims are never set here — only read, for display purposes.
  // The backend is the sole authority on admin access.
  user.getIdTokenResult().then(function (tokenResult) {
    var isAdmin = tokenResult.claims && tokenResult.claims.admin === true;
    if (userInfo) {
      userInfo.hidden = false;
      userInfo.textContent = (user.displayName || user.email) + " (" + user.email + ") — " +
        (isAdmin ? "admin access confirmed" : "signed in, but no admin access on this account");
    }
    broadcastAuthState({ signedIn: true, isAdmin: isAdmin, email: user.email, displayName: user.displayName, error: null });
  }).catch(function (err) {
    console.error("Failed to read ID token claims:", err);
    setStatus("Signed in, but failed to verify admin access: " + err.message, true);
    broadcastAuthState({ signedIn: true, isAdmin: false, email: user.email, displayName: user.displayName, error: null });
  });
});

// Attaches a fresh Firebase ID token to a protected request, for any signed-
// in user (not admin-specific — used both by admin moderation calls and by
// regular users submitting a new location). The backend verifies the token
// (and, for admin routes, the admin claim) on every call — this only
// supplies the header, it grants nothing itself.
window.getFirebaseAuthHeader = function () {
  var user = auth.currentUser;
  if (!user) {
    return Promise.reject(new Error("not signed in"));
  }
  return user.getIdToken().then(function (idToken) {
    return { Authorization: "Bearer " + idToken };
  });
};
