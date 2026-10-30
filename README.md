# UK Tick Tracker

**By Muhammad Amaan** — Elanco Placement Programme 2026, Technical Task (Frontend)

A web app that maps tick sightings across the UK, helps people understand tick risk and lets them report their own sightings. This uses the Elanco Tick Sightings API.

🎥 **Video walkthrough:** _[add your unlisted YouTube link here]_

🌐 **Live demo:** https://mr4maan.github.io/uk-tick-tracker/

---

## How to run it

No installation or build step is needed. It's plain HTML, CSS and JavaScript.

**Option 1: VS Code + Live Server (recommended)**
1. Clone or download this repository.
2. Open the folder in VS Code.
3. Install the **Live Server** extension (by Ritwick Dey).
4. Right-click `index.html` → **Open with Live Server**.

**Option 2: Just open the file**
- Double-click `index.html` to open it in a modern browser (Chrome, Edge, Firefox).

An internet connection is needed to load the map tiles, the libraries and the API data.

---

## Features

The brief asks for at least 2 requirements from each area. This is what's implemented:

| Area | Requirement | Done |
|---|---|---|
| **Interactive map** | Dynamic map of the UK | ✅ |
| | Markers with visual indicators (size = number of sightings, colour = recent activity) | ✅ |
| | Filter controls (location, species, date range) | ✅ |
| **Sighting information** | Sidebar panel with details when a marker is clicked | ✅ |
| | Timeline showing sightings per year for the selected area | ✅ |
| | Quick actions: Report a sighting, Get directions, Share | ✅ |
| **Education** | Species identification guide | ✅ |
| | Prevention tips (people and pets) | ✅ |
| | Seasonal activity chart with location and year dropdowns | ✅ |
| **Report a sighting** | Form (date, time, location, species, where found, notes) | ✅ |
| | Validation with error, warning and success messages | ✅ |
| | Image upload with preview | ✅ |
| **Extra** | Accessibility features (see below) | ✅ |

---

## Technical choices

| Choice | Why |
|---|---|
| **Plain HTML, CSS and JavaScript** | No build tools, so it's easy to run and review. The project is small enough that a framework like React would add setup without much benefit. |
| **Leaflet + OpenStreetMap** | Free, open source and lightweight. No API key needed. |
| **Chart.js** | Simple, well documented charts that look good with little code. |
| **localStorage** | Acts as this MVP's own small database for user reports, with no server needed. |

### Project structure

```
index.html     Page layout: map, details panel, education section, report form
style.css      Styling and responsive layout (works on phones)
data.js        Loads, caches and cleans data from the API
app.js         Map, markers, filters and details panel
education.js   Species guide and seasonal activity chart
report.js      Report form, validation, image upload and saved reports
```

---

## How the data is handled

The API returns sightings like this:

```json
{ "id": "...", "date": "2022-08-01T06:40:31", "location": "Manchester",
  "species": "Marsh tick", "latinName": "Ixodes apronophorus" }
```

**1. Fetching.** All sightings are fetched in one request (around 1,000 records) and then filtered in the browser. This is quicker for the size of dataset than calling the API each time a filter changes.

2. Rate limits and failures- The data is **cached in the browser for 1 hour** so it doesn’t hit the rate limit and reduces API calls.
- failed requests **retried up to 3 times**, with increasing wait times.
- If the API is down, the app **falls back to the last saved copy** and notifies the user.
-If there is no saved copy either, a clear error message is shown. The user can still see his own reports.

**3. Cleaning.** Each record is inspected before use:
- **Missing fields** or invalid dates are ignored.
- **Duplicates are ignored**: same `id`, or same date + location + species.
- **Location names** are matched regardless of capital letters or extra spaces.
- **Unknown locations** are skipped and logged.

The app shows how many records were skipped and why.

**4. Coordinates.** The API only provides a city name, so the app keeps its own lookup table of UK city coordinates.

**5. Grouping.** Sightings are grouped into one marker per city, because every sighting in a city shares the same coordinates.

**What I saw in the data:** The sightings range from 2012 to 2024 and are fairly evenly distributed over months. Real tick activity usually peaks in spring and summer. This is synthetic test data. The data only goes to 2024 so “recent activity” is based on the most recent sighting in the data, not the current date.
---

## Accessibility

- A “Skip to main content” link for keyboard users.
- All form fields are labelled. Errors are associated with their fields (aria-describedby, aria-invalid), and focus is sent to the first error.
- A **Location dropdown** opens the same details as clicking a map marker, so the map can be used without a mouse.
- Status and form messages are announced to screen readers ( `aria-` , `role="alert"` ).- Text descriptions of charts, and written summary below the seasonal chart.
Escape key closes the details panel.
- Visible focus outlines and a responsive layout for small displays.

---

## What I’d Do If I Had More Time

- **A real backend and database** (e.g. Node.js + PostgreSQL) so reports are shared with all users and not just saved in one browser. Photos uploaded would be stored in cloud storage.
- **Pinpoint locations for reports** from the browser’s location or a postcode search, instead of selecting the closest city.
- **moderation** of user reports and photos before they go public
- **Automated tests** on the cleaning of the data and validation of the forms.
- Heatmap layer and clustering, for when there are many more locations.
- Server-side filtering and pagination if dataset got way larger.
- **Dark mode** and full accessibility
