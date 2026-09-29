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

const signInBtn = document.getElementById("admin-sign-in");
const signOutBtn = document.getElementById("admin-sign-out");
const userInfo = document.getElementById("admin-user-info");
const statusEl = document.getElementById("admin-status");

function setStatus(message, isError) {
  if (!statusEl) return;
  statusEl.textContent = message || "";
  statusEl.classList.toggle("error", !!isError);
}

if (signInBtn) {
  signInBtn.addEventListener("click", function () {
    setStatus("");
    signInWithPopup(auth, provider).catch(function (err) {
      console.error("Google sign-in failed:", err);
      setStatus("Sign-in failed: " + err.message, true);
    });
  });
}

if (signOutBtn) {
  signOutBtn.addEventListener("click", function () {
    signOut(auth).catch(function (err) {
      console.error("Sign-out failed:", err);
    });
  });
}

onAuthStateChanged(auth, function (user) {
  if (!user) {
    if (signInBtn) signInBtn.hidden = false;
    if (signOutBtn) signOutBtn.hidden = true;
    if (userInfo) userInfo.hidden = true;
    return;
  }

  // setCustomParameters({hd: "umn.edu"}) only hints the Google account
  // picker — it is not enforced, so this check is required for UX. It is
  // NOT the security boundary: the backend still requires a valid Firebase
  // ID token and the admin custom claim on every protected request.
  var email = user.email || "";
  if (!email.toLowerCase().endsWith("@umn.edu")) {
    setStatus("A UMN Google account (@umn.edu) is required to sign in here.", true);
    signOut(auth).catch(function (err) {
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
  }).catch(function (err) {
    console.error("Failed to read ID token claims:", err);
    setStatus("Signed in, but failed to verify admin access: " + err.message, true);
  });
});

// For future admin UI code: attaches a fresh Firebase ID token to protected
// /api/admin/* requests. The backend verifies the token and the admin claim
// on every call — this only supplies the header, it grants nothing itself.
window.getAdminAuthHeader = function () {
  var user = auth.currentUser;
  if (!user) {
    return Promise.reject(new Error("not signed in"));
  }
  return user.getIdToken().then(function (idToken) {
    return { Authorization: "Bearer " + idToken };
  });
};
