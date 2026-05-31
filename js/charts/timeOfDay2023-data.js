/**
 * Shared preprocessing for 2023 time-of-day bushfire hotspot charts.
 * Data: datasets/northern_territory_hotspots.csv
 */
(function (global) {
  const DATA_URL = "datasets/northern_territory_hotspots.csv";
  const YEAR_PREFIX = "2023";

  const PART_ORDER = ["Morning", "Afternoon", "Evening", "Late at night"];
  const PART_COLORS = {
    "Morning":       "#f5b942",
    "Afternoon":     "#e85d2c",
    "Evening":       "#8b1a1a",
    "Late at night": "#1e3a5f"
  };

  let cachePromise = null;

  function parseAcqTime(acqTime) {
    const padded = String(acqTime == null ? "" : acqTime).trim().padStart(4, "0");
    const hour = parseInt(padded.slice(0, 2), 10);
    const minute = parseInt(padded.slice(2, 4), 10);
    if (!Number.isFinite(hour) || !Number.isFinite(minute) || hour > 23 || minute > 59) {
      return null;
    }
    const decimalHour = hour + minute / 60;
    return { hour, minute, decimalHour };
  }

  function partOfDay(hour) {
    if (hour >= 6 && hour <= 11) return "Morning";
    if (hour >= 12 && hour <= 17) return "Afternoon";
    if (hour >= 18 && hour <= 23) return "Evening";
    return "Late at night";
  }

  function partWindow(part) {
    if (part === "Morning")       return "06:00-11:59 UTC";
    if (part === "Afternoon")     return "12:00-17:59 UTC";
    if (part === "Evening")       return "18:00-23:59 UTC";
    return "00:00-05:59 UTC";
  }

  function parseHotspotLine(line, headers) {
    const cols = line.split(",");
    if (cols.length < headers.length) return null;
    const row = {};
    for (let i = 0; i < headers.length; i++) row[headers[i]] = cols[i];

    const acqDate = (row.acq_date || "").trim();
    if (!acqDate.startsWith(YEAR_PREFIX)) return null;

    const time = parseAcqTime(row.acq_time);
    if (!time) return null;

    const lat = +row.latitude;
    const lon = +row.longitude;
    const brightness = +row.brightness;
    const frp = +row.frp;
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;

    const part = partOfDay(time.hour);
    return {
      latitude: lat,
      longitude: lon,
      brightness: brightness,
      scan: row.scan,
      acq_date: acqDate,
      acq_time: row.acq_time,
      frp: frp,
      hour: time.hour,
      minute: time.minute,
      decimalHour: time.decimalHour,
      partOfDay: part
    };
  }

  function allocateWaffleSquares(partCounts, total, gridSize) {
    const cells = gridSize * gridSize;
    const raw = PART_ORDER.map(function (part) {
      const count = partCounts[part] || 0;
      const exact = total > 0 ? (count / total) * cells : 0;
      return {
        part: part,
        count: count,
        exact: exact,
        floor: Math.floor(exact),
        remainder: exact - Math.floor(exact)
      };
    });

    let assigned = raw.reduce(function (s, r) { return s + r.floor; }, 0);
    let remaining = cells - assigned;
    const sorted = raw.slice().sort(function (a, b) { return b.remainder - a.remainder; });
    for (let i = 0; i < sorted.length && remaining > 0; i++, remaining--) {
      sorted[i].floor += 1;
    }

    const pctByPart = {};
    PART_ORDER.forEach(function (part) {
      const count = partCounts[part] || 0;
      pctByPart[part] = total > 0 ? (count / total) * 100 : 0;
    });

    const squares = [];
    let idx = 0;
    PART_ORDER.forEach(function (part) {
      const slot = raw.find(function (r) { return r.part === part; });
      const n = slot ? slot.floor : 0;
      const count = partCounts[part] || 0;
      const pct = pctByPart[part];
      for (let i = 0; i < n; i++) {
        const col = idx % gridSize;
        const row = Math.floor(idx / gridSize);
        squares.push({
          id: idx,
          col: col,
          row: row,
          partOfDay: part,
          color: PART_COLORS[part],
          timeWindow: partWindow(part),
          partCount: count,
          partPct: pct,
          partPctLabel: pct.toFixed(1) + "%"
        });
        idx += 1;
      }
    });

    if (idx < cells) {
      let fillPart = PART_ORDER[0];
      PART_ORDER.forEach(function (part) {
        if ((partCounts[part] || 0) > (partCounts[fillPart] || 0)) fillPart = part;
      });
      const count = partCounts[fillPart] || 0;
      const pct = pctByPart[fillPart];
      while (idx < cells) {
        squares.push({
          id: idx,
          col: idx % gridSize,
          row: Math.floor(idx / gridSize),
          partOfDay: fillPart,
          color: PART_COLORS[fillPart],
          timeWindow: partWindow(fillPart),
          partCount: count,
          partPct: pct,
          partPctLabel: pct.toFixed(1) + "%"
        });
        idx += 1;
      }
    }

    return squares;
  }

  function waffleLegendOrder(squares) {
    const seen = {};
    squares.forEach(function (s) {
      seen[s.partOfDay] = true;
    });
    return PART_ORDER.filter(function (p) {
      return seen[p];
    });
  }

  function aggregateRecords(records) {
    const partCounts = {};
    const hourCounts = new Array(24).fill(0);
    PART_ORDER.forEach(function (p) { partCounts[p] = 0; });

    for (let i = 0; i < records.length; i++) {
      const r = records[i];
      partCounts[r.partOfDay] += 1;
      hourCounts[r.hour] += 1;
    }

    const total = records.length;
    const partStats = PART_ORDER.map(function (part) {
      const count = partCounts[part] || 0;
      const pct = total > 0 ? (count / total) * 100 : 0;
      return {
        partOfDay: part,
        count: count,
        pct: pct,
        pctLabel: pct.toFixed(1) + "%",
        color: PART_COLORS[part],
        timeWindow: partWindow(part),
        label: part + " · " + pct.toFixed(1) + "%"
      };
    });

    const hourStats = [];
    for (let h = 0; h < 24; h++) {
      const count = hourCounts[h];
      const pct = total > 0 ? (count / total) * 100 : 0;
      const theta0 = (h / 24) * 360;
      const theta1 = ((h + 1) / 24) * 360;
      hourStats.push({
        hour: h,
        hourLabel: String(h).padStart(2, "0") + ":00",
        count: count,
        pct: pct,
        pctLabel: pct.toFixed(2) + "%",
        theta0: theta0,
        theta1: theta1,
        midAngle: (theta0 + theta1) / 2
      });
    }

    const maxHourCount = hourStats.reduce(function (m, d) {
      return d.count > m ? d.count : m;
    }, 0);

    const waffleSquares = allocateWaffleSquares(partCounts, total, 10);
    const legendOrder = waffleLegendOrder(waffleSquares);
    const legendStats = partStats.filter(function (p) {
      return legendOrder.indexOf(p.partOfDay) >= 0;
    });

    return {
      year: YEAR_PREFIX,
      total: total,
      partStats: partStats,
      legendStats: legendStats,
      legendOrder: legendOrder,
      hourStats: hourStats,
      maxHourCount: maxHourCount,
      waffleSquares: waffleSquares,
      partColors: PART_COLORS,
      partOrder: PART_ORDER
    };
  }

  function parseCsv(text) {
    const lines = text.split(/\r?\n/);
    if (!lines.length) return [];
    const headers = lines[0].split(",").map(function (h) { return h.trim(); });
    const records = [];
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      if (!line) continue;
      const row = parseHotspotLine(line, headers);
      if (row) records.push(row);
    }
    return records;
  }

  function load(url) {
    url = url || DATA_URL;
    if (!cachePromise) {
      cachePromise = fetch(url)
        .then(function (res) {
          if (!res.ok) throw new Error("HTTP " + res.status + " for " + url);
          return res.text();
        })
        .then(function (text) {
          const records = parseCsv(text);
          return aggregateRecords(records);
        });
    }
    return cachePromise;
  }

  global.TimeOfDay2023 = {
    DATA_URL: DATA_URL,
    PART_ORDER: PART_ORDER,
    PART_COLORS: PART_COLORS,
    parseAcqTime: parseAcqTime,
    partOfDay: partOfDay,
    parseCsv: parseCsv,
    aggregateRecords: aggregateRecords,
    load: load
  };
})(typeof window !== "undefined" ? window : globalThis);
