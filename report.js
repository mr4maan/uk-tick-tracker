// =============================================================
// report.js — the "Report a sighting" form
// Reports are saved in the browser (localStorage), which acts as this
// MVP's own small database, and are shown on the map straight away.
// =============================================================

const REPORTS_KEY = "tickUserReports";
const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5 MB
const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
let pendingImage = null; // the resized photo, ready to save

// ---------- Saving and loading reports ----------
function getUserReports() {
  try {
    return JSON.parse(localStorage.getItem(REPORTS_KEY)) || [];
  } catch {
    return [];
  }
}

function saveUserReports(reports) {
  localStorage.setItem(REPORTS_KEY, JSON.stringify(reports));
}

// Turn a saved report into the same shape as an API sighting, so the map can use it
function reportToSighting(report) {
  const coords = getCityCoords(report.city);
  if (!coords) return null;
  return {
    id: report.id,
    date: new Date(report.date),
    city: report.city,
    species: report.species,
    latinName: report.latinName,
    lat: coords[0],
    lng: coords[1],
    userReported: true,
  };
}

function getUserReportsAsSightings() {
  return getUserReports().map(reportToSighting).filter(Boolean);
}

// ---------- Form setup ----------
function setupReportForm() {
  const cities = [...new Set(Object.keys(CITY_COORDS).map(toTitleCase))].sort();
  addOptions("reportCity", cities);
  addOptions("reportSpecies", Object.keys(SPECIES_INFO).sort());

  // You can't report a sighting in the future
  document.getElementById("reportDate").max = toInputDate(new Date());

  const form = document.getElementById("reportForm");
  form.addEventListener("submit", handleSubmit);
  form.addEventListener("reset", () => {
    clearAllMessages();
    clearImage();
    updateNotesCounter(0);
  });

  // Check each field as soon as the user leaves it
  for (const id of ["reportDate", "reportTime", "reportCity", "reportSpecies"]) {
    document.getElementById(id).addEventListener("change", () => showFieldResults(validateForm(), [id]));
  }

  document.getElementById("reportNotes").addEventListener("input", (e) => updateNotesCounter(e.target.value.length));
  document.getElementById("reportImage").addEventListener("change", handleImageChange);

  renderMyReports();
}

// Used by the "Report a sighting" button in the map panel
function prefillReportCity(city) {
  document.getElementById("reportCity").value = city;
  document.getElementById("reportTitle").focus();
}

// ---------- Validation ----------
// Returns errors (must fix) and warnings (allowed, but worth checking)
function validateForm() {
  const errors = {};
  const warnings = {};
  const date = document.getElementById("reportDate").value;
  const time = document.getElementById("reportTime").value;
  const city = document.getElementById("reportCity").value;
  const species = document.getElementById("reportSpecies").value;

  if (!date) {
    errors.reportDate = "Please enter the date you saw the tick.";
  } else {
    const chosen = new Date(date + "T00:00:00");
    const today = new Date();
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(today.getFullYear() - 1);

    if (isNaN(chosen.getTime())) errors.reportDate = "That date isn't valid.";
    else if (date > toInputDate(today)) errors.reportDate = "The date can't be in the future.";
    else if (chosen.getFullYear() < 2000) errors.reportDate = "Please enter a date from 2000 onwards.";
    else if (chosen < oneYearAgo) warnings.reportDate = "This was over a year ago. Please double-check the date.";
  }

  if (!time) {
    errors.reportTime = "Please enter roughly what time you saw it.";
  } else if (date && date === toInputDate(new Date()) && new Date(`${date}T${time}`) > new Date()) {
    errors.reportTime = "The time can't be later than now.";
  }

  if (!city) errors.reportCity = "Please choose the nearest location.";

  if (!species) {
    errors.reportSpecies = "Please choose a species, or 'Not sure'.";
  } else if (species === "Unknown") {
    warnings.reportSpecies = "That's fine. Adding a photo will help identify it.";
  }

  return { errors, warnings };
}

// Show the error/warning text under each field
function showFieldResults({ errors, warnings }, fieldIds) {
  for (const id of fieldIds) {
    const input = document.getElementById(id);
    const msg = document.getElementById(id + "Msg");
    if (errors[id]) {
      msg.textContent = errors[id];
      msg.className = "field-msg error";
      input.setAttribute("aria-invalid", "true");
    } else if (warnings[id]) {
      msg.textContent = warnings[id];
      msg.className = "field-msg warning";
      input.removeAttribute("aria-invalid");
    } else {
      msg.textContent = "";
      msg.className = "field-msg";
      input.removeAttribute("aria-invalid");
    }
  }
}

function clearAllMessages() {
  showFieldResults({ errors: {}, warnings: {} }, ["reportDate", "reportTime", "reportCity", "reportSpecies"]);
  document.getElementById("formMessage").hidden = true;
}

function showFormMessage(text, type) {
  const box = document.getElementById("formMessage");
  box.textContent = text;
  box.className = `form-message ${type}`;
  box.hidden = false;
}

function updateNotesCounter(length) {
  document.getElementById("reportNotesMsg").textContent = `${length} / 500 characters`;
}

// ---------- Image upload ----------
function handleImageChange(e) {
  const file = e.target.files[0];
  const msg = document.getElementById("reportImageMsg");
  clearImage(false);
  if (!file) return;

  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
    msg.textContent = "That file type isn't supported. Please choose a JPG, PNG or WebP image.";
    msg.className = "field-msg error";
    e.target.value = "";
    return;
  }
  if (file.size > MAX_IMAGE_BYTES) {
    msg.textContent = `That image is ${(file.size / 1024 / 1024).toFixed(1)} MB. The limit is 5 MB.`;
    msg.className = "field-msg error";
    e.target.value = "";
    return;
  }

  // Shrink the photo so it fits in browser storage
  const reader = new FileReader();
  reader.onload = () => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, 800 / Math.max(img.width, img.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
      pendingImage = canvas.toDataURL("image/jpeg", 0.8);

      const preview = document.getElementById("imagePreview");
      preview.src = pendingImage;
      preview.hidden = false;
      msg.textContent = `${file.name} added.`;
      msg.className = "field-msg success";
    };
    img.onerror = () => {
      msg.textContent = "That image couldn't be read. Please try another one.";
      msg.className = "field-msg error";
    };
    img.src = reader.result;
  };
  reader.readAsDataURL(file);
}

function clearImage(resetText = true) {
  pendingImage = null;
  const preview = document.getElementById("imagePreview");
  preview.hidden = true;
  preview.removeAttribute("src");
  if (resetText) {
    const msg = document.getElementById("reportImageMsg");
    msg.textContent = "JPG, PNG or WebP, up to 5 MB.";
    msg.className = "field-msg muted";
  }
}

// ---------- Submitting ----------
function handleSubmit(e) {
  e.preventDefault();
  const result = validateForm();
  const fields = ["reportDate", "reportTime", "reportCity", "reportSpecies"];
  showFieldResults(result, fields);

  const errorCount = Object.keys(result.errors).length;
  if (errorCount > 0) {
    showFormMessage(`Please fix ${errorCount} problem${errorCount === 1 ? "" : "s"} before submitting.`, "error");
    document.getElementById(fields.find((f) => result.errors[f])).focus();
    return;
  }

  const date = document.getElementById("reportDate").value;
  const time = document.getElementById("reportTime").value;
  const species = document.getElementById("reportSpecies").value;
  const known = allSightings.find((s) => s.species === species);

  const report = {
    id: "user-" + Date.now(),
    date: `${date}T${time}:00`,
    city: document.getElementById("reportCity").value,
    species,
    latinName: known ? known.latinName : "Unknown",
    foundOn: document.getElementById("reportFoundOn").value,
    notes: document.getElementById("reportNotes").value.trim(),
    image: pendingImage,
    submittedAt: new Date().toISOString(),
  };

  const reports = getUserReports();
  reports.push(report);
  let savedWithoutPhoto = false;
  try {
    saveUserReports(reports);
  } catch {
    // Browser storage is full: try again without the photo
    report.image = null;
    try {
      saveUserReports(reports);
      savedWithoutPhoto = true;
    } catch {
      showFormMessage("Sorry, your report couldn't be saved because this browser's storage is full.", "error");
      return;
    }
  }

  // Add it to the map straight away
  const sighting = reportToSighting(report);
  if (sighting) onSightingsChanged(() => allSightings.push(sighting));

  document.getElementById("reportForm").reset();
  showFormMessage(
    `Thank you! Your sighting in ${report.city} has been added to the map.` +
      (savedWithoutPhoto ? " (Your photo was too large to store, so it was saved without it.)" : ""),
    savedWithoutPhoto ? "warning" : "success"
  );
  renderMyReports();
}

// ---------- "Your reports" list ----------
function renderMyReports() {
  const list = document.getElementById("myReports");
  list.innerHTML = "";
  const reports = getUserReports().sort((a, b) => b.submittedAt.localeCompare(a.submittedAt));

  if (reports.length === 0) {
    const li = document.createElement("li");
    li.className = "muted";
    li.textContent = "You haven't reported any sightings yet.";
    list.appendChild(li);
    return;
  }

  for (const r of reports) {
    const li = document.createElement("li");

    if (r.image) {
      const img = document.createElement("img");
      img.src = r.image;
      img.alt = `Photo of ${r.species} reported in ${r.city}`;
      li.appendChild(img);
    }

    const text = document.createElement("div");
    const title = document.createElement("strong");
    title.textContent = `${r.species === "Unknown" ? "Unidentified tick" : r.species} in ${r.city}`;
    const details = document.createElement("div");
    details.className = "muted small";
    details.textContent = [formatDate(new Date(r.date)), r.foundOn, r.notes].filter(Boolean).join(" · ");
    text.append(title, details);
    li.appendChild(text);

    const del = document.createElement("button");
    del.type = "button";
    del.className = "btn btn-secondary btn-small";
    del.textContent = "Delete";
    del.setAttribute("aria-label", `Delete report of ${r.species} in ${r.city}`);
    del.addEventListener("click", () => deleteReport(r.id));
    li.appendChild(del);

    list.appendChild(li);
  }
}

function deleteReport(id) {
  saveUserReports(getUserReports().filter((r) => r.id !== id));
  onSightingsChanged(() => {
    allSightings = allSightings.filter((s) => s.id !== id);
  });
  renderMyReports();
}

// ---------- Helpers ----------
// Formats a date as YYYY-MM-DD in local time (the format date inputs use)
function toInputDate(date) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}
