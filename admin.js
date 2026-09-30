// Moderation UI for pending location submissions. Kept separate from
// firebase-auth.js: this file only reacts to the "firebase-auth-changed" event
// it dispatches and calls window.getFirebaseAuthHeader() for a bearer token.
// Frontend admin=true gating here is UI convenience only — the backend
// verifies the token and the admin claim on every request and is the real
// authorization boundary.

var moderationSection = document.getElementById("moderation-section");
var pendingLoading = document.getElementById("pending-loading");
var pendingEmpty = document.getElementById("pending-empty");
var pendingError = document.getElementById("pending-error");
var pendingList = document.getElementById("pending-list");

var knownFieldLabels = {
  name: "Name",
  hall: "Building / Hall",
  floor: "Floor",
  note: "Note"
};

function setHidden(el, hidden) {
  if (el) el.hidden = hidden;
}

function clearPendingList() {
  if (pendingList) pendingList.innerHTML = "";
  setHidden(pendingLoading, true);
  setHidden(pendingEmpty, true);
  setHidden(pendingError, true);
}

function showLoading() {
  clearPendingList();
  setHidden(pendingLoading, false);
}

function showLoadError(message) {
  clearPendingList();
  if (pendingError) pendingError.textContent = message;
  setHidden(pendingError, false);
}

function formatSubmittedTime(createdAt) {
  if (!createdAt) return null;
  var date = new Date(createdAt);
  if (isNaN(date.getTime())) return createdAt;
  return date.toLocaleString();
}

function addField(container, label, value) {
  if (value === undefined || value === null || value === "") return;
  var row = document.createElement("div");
  row.className = "submission-field";
  row.innerHTML = "<strong>" + label + ":</strong> ";
  var span = document.createElement("span");
  span.textContent = value;
  row.appendChild(span);
  container.appendChild(row);
}

function renderSubmissionCard(submission) {
  var card = document.createElement("div");
  card.className = "submission-card";

  var header = document.createElement("div");
  header.className = "submission-header";
  header.textContent = submission.category;
  var submittedTime = formatSubmittedTime(submission.createdAt);
  if (submittedTime) {
    var timeEl = document.createElement("span");
    timeEl.className = "submission-time";
    timeEl.textContent = "Submitted " + submittedTime;
    header.appendChild(timeEl);
  }
  card.appendChild(header);

  var fields = document.createElement("div");
  fields.className = "submission-fields";

  var properties = submission.properties || {};
  addField(fields, "Name", properties.name);
  addField(fields, "Building / Hall", properties.hall);
  addField(fields, "Floor", properties.floor);
  addField(fields, "Note", properties.note);
  addField(fields, "Location", submission.lat + ", " + submission.lng);

  // Any category-specific properties beyond the common ones above (e.g.
  // busstops' stop/route, bike's location/capacity) are shown generically.
  Object.keys(properties).forEach(function (key) {
    if (knownFieldLabels[key]) return;
    addField(fields, key, properties[key]);
  });

  card.appendChild(fields);

  var errorEl = document.createElement("div");
  errorEl.className = "submission-error";
  errorEl.hidden = true;
  card.appendChild(errorEl);

  var actions = document.createElement("div");
  actions.className = "submission-actions";

  var approveBtn = document.createElement("button");
  approveBtn.textContent = "Approve";
  approveBtn.className = "approve-btn";

  var rejectBtn = document.createElement("button");
  rejectBtn.textContent = "Reject";
  rejectBtn.className = "reject-btn";

  function review(action) {
    approveBtn.disabled = true;
    rejectBtn.disabled = true;
    errorEl.hidden = true;

    window.getFirebaseAuthHeader()
      .then(function (authHeader) {
        return fetch(API_BASE + "/api/admin/submissions/" + submission.id + "/" + action, {
          method: "POST",
          headers: authHeader
        });
      })
      .then(function (res) {
        if (!res.ok) {
          return res.text().then(function (text) {
            throw new Error("HTTP " + res.status + (text ? ": " + text : ""));
          });
        }
        return res.json();
      })
      .then(function () {
        card.remove();
        if (pendingList && pendingList.children.length === 0) {
          setHidden(pendingEmpty, false);
        }
      })
      .catch(function (err) {
        console.error("Failed to " + action + " submission " + submission.id + ":", err);
        errorEl.textContent = "Failed to " + action + " this submission: " + err.message;
        errorEl.hidden = false;
        approveBtn.disabled = false;
        rejectBtn.disabled = false;
      });
  }

  approveBtn.addEventListener("click", function () { review("approve"); });
  rejectBtn.addEventListener("click", function () { review("reject"); });

  actions.appendChild(approveBtn);
  actions.appendChild(rejectBtn);
  card.appendChild(actions);

  return card;
}

function loadPendingSubmissions() {
  showLoading();

  window.getFirebaseAuthHeader()
    .then(function (authHeader) {
      return fetch(API_BASE + "/api/admin/submissions?status=pending", { headers: authHeader });
    })
    .then(function (res) {
      if (!res.ok) {
        return res.text().then(function (text) {
          throw new Error("HTTP " + res.status + (text ? ": " + text : ""));
        });
      }
      return res.json();
    })
    .then(function (submissions) {
      clearPendingList();
      if (!submissions || submissions.length === 0) {
        setHidden(pendingEmpty, false);
        return;
      }
      submissions.forEach(function (submission) {
        pendingList.appendChild(renderSubmissionCard(submission));
      });
    })
    .catch(function (err) {
      console.error("Failed to load pending submissions:", err);
      showLoadError("Failed to load pending submissions: " + err.message);
    });
}

document.addEventListener("firebase-auth-changed", function (e) {
  var detail = e.detail || {};
  if (detail.isAdmin) {
    setHidden(moderationSection, false);
    loadPendingSubmissions();
  } else {
    setHidden(moderationSection, true);
    clearPendingList();
  }
});
