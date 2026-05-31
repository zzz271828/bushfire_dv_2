/**
 * Shared preprocessing for community preparedness charts (7, 8, 9).
 */
(function (global) {
  const PRIMARY_URL = "datasets/Community_Bushfire_Risk.csv";
  const FALLBACK_URL = "datasets/Community_Bushfire_Risk.csv";

  let cachePromise = null;

  function parseYesNo(value) {
    return String(value || "").trim().toLowerCase() === "yes" ? 1 : 0;
  }

  function normalizeRating(value) {
    const v = String(value || "").trim().toLowerCase();
    if (v === "high") return "High";
    if (v === "moderate") return "Moderate";
    if (v === "low") return "Low";
    return "Unknown";
  }

  function cleanRow(row) {
    const population = +String(row.POPULATION || "").replace(/,/g, "").trim();
    const fuel = parseYesNo(row.FUELREDUC);
    const firebreak = parseYesNo(row.FIREBREAK);
    const fireplan = parseYesNo(row.FIREPLAN);
    return {
      COMMUNITY: String(row.COMMUNITY || "").trim(),
      RATING: normalizeRating(row.RATING),
      POPULATION: Number.isFinite(population) ? population : null,
      FUELREDUC: fuel ? "Yes" : "No",
      FIREBREAK: firebreak ? "Yes" : "No",
      FIREPLAN: fireplan ? "Yes" : "No",
      LGA: String(row.LGA || "").trim() || "Unknown",
      COMMTYPE: String(row.COMMTYPE || "").trim() || "Unknown",
      prepFuel: fuel,
      prepBreak: firebreak,
      prepPlan: fireplan,
      preparednessScore: fuel + firebreak + fireplan
    };
  }

  function withMissingMeasures(row) {
    const missing = [];
    if (!row.prepFuel) missing.push("Fuel reduction");
    if (!row.prepBreak) missing.push("Firebreak");
    if (!row.prepPlan) missing.push("Fire plan");
    return Object.assign({}, row, {
      missingMeasures: missing.length ? missing.join(", ") : "None"
    });
  }

  function fetchCsv(url) {
    return fetch(url).then(function (res) {
      if (!res.ok) throw new Error("HTTP " + res.status + " for " + url);
      return res.text();
    });
  }

  function parseCsvLine(line) {
    const out = [];
    let cur = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') {
          cur += '"';
          i += 1;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (ch === "," && !inQuotes) {
        out.push(cur);
        cur = "";
      } else {
        cur += ch;
      }
    }
    out.push(cur);
    return out;
  }

  function parseCsv(text) {
    const lines = text.split(/\r?\n/).filter(function (l) { return l.trim(); });
    if (!lines.length) return [];
    const headers = parseCsvLine(lines[0]).map(function (h) { return h.trim(); });
    const rows = [];
    for (let i = 1; i < lines.length; i++) {
      const cols = parseCsvLine(lines[i]);
      const row = {};
      for (let j = 0; j < headers.length; j++) {
        row[headers[j]] = cols[j] == null ? "" : cols[j];
      }
      rows.push(row);
    }
    return rows;
  }

  function load() {
    if (!cachePromise) {
      cachePromise = fetchCsv(PRIMARY_URL)
        .catch(function () { return fetchCsv(FALLBACK_URL); })
        .then(function (text) {
          const rows = parseCsv(text).map(cleanRow).map(withMissingMeasures);
          const ratings = ["Low", "Moderate", "High"];
          return {
            rows: rows,
            ratings: ratings,
            lgaOptions: Array.from(new Set(rows.map(function (d) { return d.LGA; }))).sort()
          };
        });
    }
    return cachePromise;
  }

  global.CommunityData = {
    load: load
  };
})(typeof window !== "undefined" ? window : globalThis);
