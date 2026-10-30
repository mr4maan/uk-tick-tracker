// =============================================================
// education.js — species guide and seasonal activity chart
// (uses allSightings from app.js, so it runs after the data loads)
// =============================================================

// Information for each species in the dataset.
// Kept general and cautious — this is an awareness tool, not medical advice.
const SPECIES_INFO = {
  "Marsh tick": {
    habitat: "Wet, marshy ground and riverbanks.",
    hosts: "Small mammals, especially voles.",
    risk: "Low",
    note: "Rarely bites people or pets.",
  },
  "Southern rodent tick": {
    habitat: "Woodland and hedgerows, more common in southern areas.",
    hosts: "Mice, voles and other small rodents.",
    risk: "Low",
    note: "Mostly stays on rodents but can occasionally bite people.",
  },
  "Passerine tick": {
    habitat: "Leaf litter and undergrowth where birds feed.",
    hosts: "Songbirds such as blackbirds and robins.",
    risk: "Low",
    note: "Mainly a bird tick. Can be carried long distances by birds.",
  },
  "Tree-hole tick": {
    habitat: "Tree holes and nest boxes.",
    hosts: "Birds that nest in holes, such as tits.",
    risk: "Low",
    note: "Rarely found away from nests, so bites are uncommon.",
  },
  "Fox/badger tick": {
    habitat: "Burrows, dens and setts.",
    hosts: "Foxes, badgers — and dogs.",
    risk: "Medium",
    note: "Most relevant to pet owners: dogs can pick it up near dens and burrows.",
  },
};

let seasonChart = null;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// Called by app.js once the data has loaded
function setupEducation() {
  renderSpeciesGuide();

  addOptions("seasonCity", [...new Set(allSightings.map((s) => s.city))].sort());
  const years = [...new Set(allSightings.map((s) => s.date.getFullYear()))].sort((a, b) => b - a);
  addOptions("seasonYear", years.map(String));

  document.getElementById("seasonCity").addEventListener("change", renderSeasonChart);
  document.getElementById("seasonYear").addEventListener("change", renderSeasonChart);
  renderSeasonChart();
}

function renderSpeciesGuide() {
  const guide = document.getElementById("speciesGuide");
  guide.innerHTML = "";

  // Build one card per species found in the data, with its count and Latin name
  const species = {};
  for (const s of allSightings) {
    if (s.species === "Unknown") continue; // user reports marked "Not sure"
    if (!species[s.species]) species[s.species] = { latin: s.latinName, count: 0 };
    species[s.species].count++;
  }

  Object.entries(species)
    .sort((a, b) => b[1].count - a[1].count)
    .forEach(([name, { latin, count }]) => {
      const info = SPECIES_INFO[name];
      const card = document.createElement("article");
      card.className = "species-card";

      const title = document.createElement("h4");
      title.textContent = name;
      const latinName = document.createElement("p");
      latinName.className = "latin";
      latinName.textContent = latin;
      card.append(title, latinName);

      if (info) {
        const badge = document.createElement("span");
        badge.className = `risk-badge risk-${info.risk.toLowerCase()}`;
        badge.textContent = `Risk to people & pets: ${info.risk}`;

        const details = document.createElement("dl");
        details.innerHTML = "<dt>Where</dt><dd></dd><dt>Feeds on</dt><dd></dd>";
        const dds = details.querySelectorAll("dd");
        dds[0].textContent = info.habitat;
        dds[1].textContent = info.hosts;

        const note = document.createElement("p");
        note.textContent = info.note;
        card.append(badge, details, note);
      } else {
        // A species we don't have information for yet
        const note = document.createElement("p");
        note.textContent = "No guide information yet for this species.";
        card.append(note);
      }

      const seen = document.createElement("p");
      seen.className = "muted small";
      seen.textContent = `${count} sightings in our data`;
      card.append(seen);

      guide.appendChild(card);
    });
}

// Seasonal chart: number of sightings in each month for the chosen city and year
function renderSeasonChart() {
  const city = document.getElementById("seasonCity").value;
  const year = document.getElementById("seasonYear").value;

  const matching = allSightings.filter((s) =>
    (city === "all" || s.city === city) &&
    (year === "all" || s.date.getFullYear() === Number(year))
  );

  const perMonth = new Array(12).fill(0);
  for (const s of matching) perMonth[s.date.getMonth()]++;

  if (seasonChart) seasonChart.destroy();
  seasonChart = new Chart(document.getElementById("seasonChart"), {
    type: "bar",
    data: {
      labels: MONTHS,
      datasets: [{ label: "Sightings", data: perMonth, backgroundColor: "#1f6f50", borderRadius: 4 }],
    },
    options: {
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: { y: { beginAtZero: true, ticks: { precision: 0 } } },
    },
  });

  // A one-line summary, which also helps screen reader users
  const place = city === "all" ? "the UK" : city;
  const when = year === "all" ? "across all years" : `in ${year}`;
  const summary = document.getElementById("seasonSummary");
  if (matching.length === 0) {
    summary.textContent = `No sightings recorded in ${place} ${when}.`;
  } else {
    const peak = perMonth.indexOf(Math.max(...perMonth));
    summary.textContent = `${matching.length} sightings in ${place} ${when}. Busiest month: ${MONTHS[peak]}.`;
  }
}
