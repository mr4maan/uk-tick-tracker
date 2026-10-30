// =============================================================
// app.js — draws the map, markers, filters and the details panel
// =============================================================

let allSightings = [];   // every clean sighting from the API
let latestDate = null;   // most recent sighting date in the data (used for "recent" colours)
let map;
let markerLayer;
let selectedCity = null; // the city whose details panel is open
let timelineChart = null;

// ---------- Start the app ----------
document.addEventListener("DOMContentLoaded", async () => {
  setupMap();
  setupFilters();
  setupPanel();
  setupReportForm(); // from report.js — works even if the API is down
  await loadData();

  // If someone opened a shared link like index.html?city=Leeds, open that city
  const sharedCity = new URLSearchParams(window.location.search).get("city");
  if (sharedCity && allSightings.some((s) => s.city === sharedCity)) {
    openPanel(sharedCity);
  }
});

function setupMap() {
  // Centre on the UK
  map = L.map("map").setView([54.5, -3], 6);

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 18,
    attribution: "&copy; OpenStreetMap contributors",
  }).addTo(map);

  markerLayer = L.layerGroup().addTo(map);
}

async function loadData() {
  showStatus("Loading tick sightings…");

  try {
    const { sightings, report, source } = await loadSightings();
    // API sightings + any sightings this user has reported
    allSightings = [...sightings, ...getUserReportsAsSightings()];
    // "Recent" is measured against the newest API sighting
    latestDate = sightings.length ? new Date(Math.max(...sightings.map((s) => s.date))) : new Date();

    fillDropdowns();
    updateMap();
    setupEducation(); // from education.js

    // Tell the user about any data we had to skip
    const skipped = report.duplicates + report.incomplete + report.unknownCity;
    let message = "";
    if (source === "stale-cache") {
      message = "Couldn't reach the API, so you're seeing a saved copy of the data. ";
    }
    if (skipped > 0) {
      message += `${skipped} of ${report.total} records were skipped ` +
        `(${report.duplicates} duplicates, ${report.incomplete} incomplete, ${report.unknownCity} unknown location).`;
    }
    showStatus(message, message ? "warning" : "");
  } catch (error) {
    showStatus(`Sorry, the tick data couldn't be loaded. ${error.message}`, "error");
    // Still show the user's own reports
    allSightings = getUserReportsAsSightings();
    latestDate = new Date();
    fillDropdowns();
    updateMap();
  }
}

// Called by report.js when a sighting is added or deleted:
// make the change, then refresh everything that uses the data
function onSightingsChanged(change) {
  change();
  addMissingOptions("cityFilter", allSightings.map((s) => s.city));
  addMissingOptions("speciesFilter", allSightings.map((s) => s.species));
  addMissingOptions("seasonCity", allSightings.map((s) => s.city));
  updateMap();
  if (typeof renderSpeciesGuide === "function" && allSightings.length) {
    renderSpeciesGuide();
    renderSeasonChart();
  }
}

function addMissingOptions(selectId, values) {
  const select = document.getElementById(selectId);
  const existing = new Set([...select.options].map((o) => o.value));
  addOptions(selectId, [...new Set(values)].filter((v) => !existing.has(v)));
}

// ---------- Filters ----------
function setupFilters() {
  document.getElementById("speciesFilter").addEventListener("change", updateMap);
  document.getElementById("dateFrom").addEventListener("change", updateMap);
  document.getElementById("dateTo").addEventListener("change", updateMap);

  // Picking a location also opens its details (handy for keyboard users)
  document.getElementById("cityFilter").addEventListener("change", (e) => {
    updateMap();
    if (e.target.value === "all") closePanel();
    else openPanel(e.target.value);
  });

  document.getElementById("resetFilters").addEventListener("click", () => {
    document.getElementById("cityFilter").value = "all";
    document.getElementById("speciesFilter").value = "all";
    document.getElementById("dateFrom").value = "";
    document.getElementById("dateTo").value = "";
    closePanel();
    updateMap();
  });
}

function fillDropdowns() {
  addOptions("speciesFilter", [...new Set(allSightings.map((s) => s.species))].sort());
  addOptions("cityFilter", [...new Set(allSightings.map((s) => s.city))].sort());
}

function addOptions(selectId, values) {
  const select = document.getElementById(selectId);
  for (const value of values) {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = value;
    select.appendChild(option);
  }
}

// Returns the sightings that match the current filter settings
function getFilteredSightings() {
  const city = document.getElementById("cityFilter").value;
  const species = document.getElementById("speciesFilter").value;
  const from = document.getElementById("dateFrom").value;
  const to = document.getElementById("dateTo").value;

  const fromDate = from ? new Date(from + "T00:00:00") : null;
  const toDate = to ? new Date(to + "T23:59:59") : null;

  return allSightings.filter((s) => {
    if (city !== "all" && s.city !== city) return false;
    if (species !== "all" && s.species !== species) return false;
    if (fromDate && s.date < fromDate) return false;
    if (toDate && s.date > toDate) return false;
    return true;
  });
}

// ---------- Markers ----------
// Groups sightings by city so each city gets one marker
function groupByCity(sightings) {
  const groups = {};
  for (const s of sightings) {
    if (!groups[s.city]) groups[s.city] = { city: s.city, lat: s.lat, lng: s.lng, sightings: [] };
    groups[s.city].sightings.push(s);
  }
  return Object.values(groups);
}

// Colour depends on how recent the newest sighting in that city is
function getActivityColour(newestDate) {
  const daysAgo = (latestDate - newestDate) / (1000 * 60 * 60 * 24);
  if (daysAgo <= 30) return "#d62828"; // high
  if (daysAgo <= 90) return "#f77f00"; // medium
  return "#fcbf49";                     // low
}

function updateMap() {
  markerLayer.clearLayers();
  const filtered = getFilteredSightings();
  const cities = groupByCity(filtered);

  for (const group of cities) {
    const count = group.sightings.length;
    const newest = new Date(Math.max(...group.sightings.map((s) => s.date)));

    const marker = L.circleMarker([group.lat, group.lng], {
      radius: Math.min(5 + Math.sqrt(count) * 1.3, 22), // bigger = more sightings
      color: "#333",
      weight: 1,
      fillColor: getActivityColour(newest),
      fillOpacity: 0.8,
    });

    marker.bindTooltip(`${group.city}: ${count} sighting${count === 1 ? "" : "s"}`);
    marker.on("click", () => openPanel(group.city));
    marker.addTo(markerLayer);
  }

  document.getElementById("resultCount").textContent =
    `Showing ${filtered.length} sighting${filtered.length === 1 ? "" : "s"} in ` +
    `${cities.length} location${cities.length === 1 ? "" : "s"}`;

  // Keep the open panel in sync with the filters
  if (selectedCity) renderPanel();
}

// ---------- Details panel ----------
function setupPanel() {
  document.getElementById("closePanel").addEventListener("click", closePanel);
  document.getElementById("shareBtn").addEventListener("click", shareCity);
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closePanel();
  });
}

function openPanel(city) {
  selectedCity = city;
  const panel = document.getElementById("detailPanel");
  panel.hidden = false;
  renderPanel();
  map.invalidateSize(); // the map got narrower, so let Leaflet redraw
  document.getElementById("panelTitle").focus();
}

function closePanel() {
  selectedCity = null;
  document.getElementById("detailPanel").hidden = true;
  if (map) map.invalidateSize();
}

function renderPanel() {
  const sightings = getFilteredSightings()
    .filter((s) => s.city === selectedCity)
    .sort((a, b) => b.date - a.date); // newest first

  document.getElementById("panelTitle").textContent = selectedCity;
  document.getElementById("panelSummary").textContent = sightings.length
    ? `${sightings.length} sightings · most recent ${formatDate(sightings[0].date)}`
    : "No sightings match the current filters.";

  // Quick action: directions opens Google Maps
  const { lat, lng } = allSightings.find((s) => s.city === selectedCity);
  document.getElementById("directionsBtn").href =
    `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
  document.getElementById("shareMessage").textContent = "";
  // Quick action: report button jumps to the form with this city filled in
  const city = selectedCity;
  document.getElementById("reportHere").onclick = () => prefillReportCity(city);

  renderSpeciesBreakdown(sightings);
  renderRecentList(sightings);
  renderTimeline(sightings);
}

function renderSpeciesBreakdown(sightings) {
  const counts = {};
  for (const s of sightings) counts[s.species] = (counts[s.species] || 0) + 1;

  const list = document.getElementById("speciesBreakdown");
  list.innerHTML = "";
  Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .forEach(([species, count]) => {
      const li = document.createElement("li");
      li.innerHTML = `<span></span><strong>${count}</strong>`;
      li.firstChild.textContent = species; // textContent is safe from injected HTML
      list.appendChild(li);
    });
}

function renderRecentList(sightings) {
  const list = document.getElementById("recentList");
  list.innerHTML = "";
  for (const s of sightings.slice(0, 5)) {
    const li = document.createElement("li");
    const name = document.createElement("div");
    name.textContent = `${s.species} — ${formatDate(s.date)}${s.userReported ? " (your report)" : ""}`;
    const latin = document.createElement("div");
    latin.className = "latin";
    latin.textContent = s.latinName;
    li.append(name, latin);
    list.appendChild(li);
  }
}

// Timeline: sightings per year in the selected city
function renderTimeline(sightings) {
  const years = allSightings.map((s) => s.date.getFullYear());
  const firstYear = Math.min(...years);
  const lastYear = Math.max(...years);

  const labels = [];
  const counts = [];
  for (let y = firstYear; y <= lastYear; y++) {
    labels.push(String(y));
    counts.push(sightings.filter((s) => s.date.getFullYear() === y).length);
  }

  if (timelineChart) timelineChart.destroy();
  timelineChart = new Chart(document.getElementById("timelineChart"), {
    type: "line",
    data: {
      labels,
      datasets: [{
        label: "Sightings",
        data: counts,
        borderColor: "#1f6f50",
        backgroundColor: "rgba(31, 111, 80, 0.15)",
        fill: true,
        tension: 0.3,
      }],
    },
    options: {
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: { y: { beginAtZero: true, ticks: { precision: 0 } } },
    },
  });
}

// Share: uses the phone's share menu if available, otherwise copies the link
async function shareCity() {
  const url = `${window.location.origin}${window.location.pathname}?city=${encodeURIComponent(selectedCity)}`;
  const message = document.getElementById("shareMessage");
  try {
    if (navigator.share) {
      await navigator.share({ title: `Tick sightings in ${selectedCity}`, url });
    } else {
      await navigator.clipboard.writeText(url);
      message.textContent = "Link copied to clipboard!";
    }
  } catch {
    message.textContent = `Copy this link: ${url}`;
  }
}

// ---------- Helpers ----------
function formatDate(date) {
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function showStatus(message, type = "") {
  const el = document.getElementById("status");
  el.textContent = message;
  el.className = "status " + type;
}
