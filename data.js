// =============================================================
// data.js — loads tick sightings from the Elanco API and cleans them
// =============================================================

const API_BASE = "https://dev-task.elancoapps.com/data";
const CACHE_KEY = "tickSightingsCache";
const CACHE_MAX_AGE_MS = 60 * 60 * 1000; // keep a saved copy for 1 hour

// The API only gives a city name, not coordinates,
// so we keep our own lookup table (keys are lowercase so "London" and "london" both match).
const CITY_COORDS = {
  "london": [51.5074, -0.1278],
  "manchester": [53.4808, -2.2426],
  "birmingham": [52.4862, -1.8904],
  "leeds": [53.8008, -1.5491],
  "glasgow": [55.8642, -4.2518],
  "edinburgh": [55.9533, -3.1883],
  "liverpool": [53.4084, -2.9916],
  "bristol": [51.4545, -2.5879],
  "sheffield": [53.3811, -1.4701],
  "newcastle": [54.9783, -1.6178],
  "newcastle upon tyne": [54.9783, -1.6178],
  "nottingham": [52.9548, -1.1581],
  "leicester": [52.6369, -1.1398],
  "cardiff": [51.4816, -3.1791],
  "belfast": [54.5973, -5.9301],
  "southampton": [50.9097, -1.4044],
  "portsmouth": [50.8198, -1.0880],
  "brighton": [50.8225, -0.1372],
  "plymouth": [50.3755, -4.1427],
  "oxford": [51.7520, -1.2577],
  "cambridge": [52.2053, 0.1218],
  "york": [53.9600, -1.0873],
  "aberdeen": [57.1497, -2.0943],
  "inverness": [57.4778, -4.2247],
  "dundee": [56.4620, -2.9707],
  "stirling": [56.1165, -3.9369],
  "perth": [56.3950, -3.4308],
  "norwich": [52.6309, 1.2974],
  "exeter": [50.7184, -3.5339],
  "bath": [51.3758, -2.3599],
  "coventry": [52.4068, -1.5197],
  "hull": [53.7676, -0.3274],
  "derby": [52.9225, -1.4746],
  "stoke-on-trent": [53.0027, -2.1794],
  "swansea": [51.6214, -3.9436],
  "reading": [51.4543, -0.9781],
  "milton keynes": [52.0406, -0.7594],
  "sunderland": [54.9069, -1.3838],
  "wolverhampton": [52.5862, -2.1288],
  "bradford": [53.7960, -1.7594],
  "preston": [53.7632, -2.7031],
  "lancaster": [54.0466, -2.8007],
  "carlisle": [54.8925, -2.9329],
  "chester": [53.1934, -2.8931],
  "gloucester": [51.8642, -2.2382],
  "worcester": [52.1920, -2.2200],
  "lincoln": [53.2307, -0.5406],
  "peterborough": [52.5695, -0.2405],
  "ipswich": [52.0567, 1.1482],
  "canterbury": [51.2802, 1.0789],
  "salisbury": [51.0688, -1.7945],
  "truro": [50.2632, -5.0510],
  "bournemouth": [50.7192, -1.8808],
  "middlesbrough": [54.5742, -1.2350],
  "wrexham": [53.0465, -2.9938],
  "londonderry": [54.9966, -7.3086],
  "derry": [54.9966, -7.3086],
};

// Look up a city's coordinates, ignoring capital letters and extra spaces
function getCityCoords(city) {
  return CITY_COORDS[city.trim().toLowerCase()] || null;
}

// Fetch a URL, retrying a few times if it fails (e.g. rate limit or network blip)
async function fetchWithRetry(url, retries = 3) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const response = await fetch(url);
      if (response.status === 429) throw new Error("The API is busy (rate limit). Please try again in a minute.");
      if (!response.ok) throw new Error(`The API returned an error (status ${response.status}).`);
      return await response.json();
    } catch (error) {
      if (attempt === retries) throw error;
      // wait a bit longer each time before retrying: 1s, 2s, 3s...
      await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
    }
  }
}

// Turn the raw API data into clean, usable sightings.
// Skips duplicates, records with missing fields, bad dates and unknown cities,
// and counts each problem so we can show it to the user.
function cleanSightings(raw) {
  const seenIds = new Set();
  const seenContent = new Set();
  const clean = [];
  const report = { total: raw.length, duplicates: 0, incomplete: 0, unknownCity: 0 };

  for (const s of raw) {
    // 1. Missing fields
    if (!s || !s.id || !s.date || !s.location || !s.species) {
      report.incomplete++;
      continue;
    }

    // 2. Invalid date
    const date = new Date(s.date);
    if (isNaN(date.getTime())) {
      report.incomplete++;
      continue;
    }

    // 3. Duplicates: same id, or same date + city + species
    const contentKey = `${s.date}|${s.location.trim().toLowerCase()}|${s.species.trim().toLowerCase()}`;
    if (seenIds.has(s.id) || seenContent.has(contentKey)) {
      report.duplicates++;
      continue;
    }

    // 4. City we don't have coordinates for
    const coords = getCityCoords(s.location);
    if (!coords) {
      report.unknownCity++;
      console.warn("No coordinates for city:", s.location);
      continue;
    }

    seenIds.add(s.id);
    seenContent.add(contentKey);
    clean.push({
      id: s.id,
      date: date,
      city: toTitleCase(s.location.trim()),
      species: s.species.trim(),
      latinName: s.latinName ? s.latinName.trim() : "Unknown",
      lat: coords[0],
      lng: coords[1],
    });
  }

  return { sightings: clean, report };
}

function toTitleCase(text) {
  return text.toLowerCase().replace(/(^|[\s-])\w/g, (c) => c.toUpperCase());
}

// Read the saved copy of the data from the browser (if there is one)
function readCache() {
  try {
    return JSON.parse(localStorage.getItem(CACHE_KEY));
  } catch {
    return null;
  }
}

// Main function the app calls: returns { sightings, report, source }
async function loadSightings() {
  const cached = readCache();

  // Use the saved copy if it's less than an hour old (saves API calls)
  if (cached && Date.now() - cached.savedAt < CACHE_MAX_AGE_MS) {
    return { ...cleanSightings(cached.data), source: "cache" };
  }

  try {
    const raw = await fetchWithRetry(`${API_BASE}/tick-sightings`);
    if (!Array.isArray(raw)) throw new Error("The API sent data in an unexpected format.");

    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify({ savedAt: Date.now(), data: raw }));
    } catch {
      // storage full or blocked — the app still works without it
    }
    return { ...cleanSightings(raw), source: "api" };
  } catch (error) {
    // API is down: fall back to an older saved copy if we have one
    if (cached) return { ...cleanSightings(cached.data), source: "stale-cache" };
    throw error;
  }
}
