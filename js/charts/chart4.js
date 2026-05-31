/**
 * Chart 4 -- NT Fire Intensity Linked Views (year playback, no brush).
 * Data: datasets/northern_territory_hotspots.csv
 * Basemap: NT outline from australia_states.geojson (same source as chart1)
 */
(function () {
  if (window.__chart4Initialized) return;
  window.__chart4Initialized = true;

  const YEARS = [];
  for (let y = 2014; y <= 2024; y++) YEARS.push(y);

  const DATA_URL = "datasets/northern_territory_hotspots.csv";

  const MAX_FIRES_PER_YEAR = 1800;
  const MAX_MAP_POINTS_YEAR = 2000;

  const chartContainer = document.getElementById("chart4");
  if (!chartContainer || typeof vegaEmbed === "undefined") return;

  chartContainer.innerHTML = [
    '<div class="chart4-toolbar">',
    '  <div class="chart4-controls">',
    '    <button class="chart4-btn" id="c4Play" type="button">&#9654; Play</button>',
    '    <button class="chart4-btn" id="c4Pause" type="button" disabled>&#9646;&#9646; Pause</button>',
    '    <button class="chart4-btn" id="c4Restart" type="button">&#8635; Restart</button>',
    '    <label class="chart4-year-label" for="c4Year">Year <span id="c4YearValue">2014</span></label>',
    '    <input id="c4Year" type="range" min="2014" max="2024" step="1" value="2014" />',
    "  </div>",
    '  <div class="chart4-metrics" id="c4Metrics"></div>',
    "</div>",
    '<div class="chart4-body">',
    '  <div id="chart4Viz"></div>',
    "</div>"
  ].join("");

  const playBtn    = document.getElementById("c4Play");
  const pauseBtn   = document.getElementById("c4Pause");
  const restartBtn = document.getElementById("c4Restart");
  const yearInput  = document.getElementById("c4Year");
  const yearValue  = document.getElementById("c4YearValue");
  const metricsEl  = document.getElementById("c4Metrics");
  const vizEl      = document.getElementById("chart4Viz");

  let currentYear = 2014;
  let isPlaying   = false;
  let timer       = null;
  let embedResult = null;

  let firesAll       = [];
  let mapAll         = [];
  let yearlyCounts   = {};
  let topEventByYear = {};
  let ntOutline      = null;

  function getNtOutline() {
    if (ntOutline) return Promise.resolve(ntOutline);

    function pickNt(geojson) {
      if (!geojson || !geojson.features) throw new Error("Invalid GeoJSON for NT boundary");
      const feat = geojson.features.find(function (f) {
        return f.properties && f.properties.STATE_NAME === "Northern Territory";
      });
      if (!feat || !feat.geometry) throw new Error("Northern Territory feature not found in states GeoJSON");
      ntOutline = feat;
      return ntOutline;
    }

    if (typeof window.__AU_STATES_GEOJSON__ !== "undefined") {
      return Promise.resolve(pickNt(window.__AU_STATES_GEOJSON__));
    }

    return fetch("datasets/australia_states.geojson")
      .then(function (r) {
        if (!r.ok) throw new Error("HTTP " + r.status + " for australia_states.geojson");
        return r.json();
      })
      .then(function (g) {
        window.__AU_STATES_GEOJSON__ = g;
        return pickNt(g);
      });
  }

  function mapProjection(mapW, mapH, pad, shiftX) {
    const innerW = mapW - pad.left - pad.right;
    const innerH = mapH - pad.top - pad.bottom;
    const scale = Math.round(Math.min(innerW * 4.38, innerH * 7.7));
    return {
      type: "mercator",
      rotate: [-133, 0, 0],
      center: [0, -19],
      scale: scale,
      translate: [pad.left + innerW / 2 + (shiftX || 0), pad.top + innerH / 2]
    };
  }

  function vizBox() {
    const body = chartContainer.querySelector(".chart4-body");
    if (!body) return { w: 240, h: 240 };
    const w = Math.max(160, Math.floor(body.clientWidth));
    const h = Math.max(160, Math.floor(body.clientHeight));
    return { w: w, h: h };
  }

  function setButtons() {
    playBtn.disabled  = isPlaying;
    pauseBtn.disabled = !isPlaying;
  }

  function updateYearUI() {
    yearValue.textContent = String(currentYear);
    if (yearInput) yearInput.value = String(currentYear);
  }

  function fmt(n) { return Number(n || 0).toLocaleString(); }

  function updateMetrics() {
    const total   = yearlyCounts[currentYear] || 0;
    const top     = topEventByYear[currentYear];
    const topText = top
      ? ("Top FRP: " + top.frp.toFixed(1) + " MW (" + top.acq_date + " " + top.acq_time + ")")
      : "Top FRP: n/a";
    metricsEl.innerHTML =
      "<span><b>" + fmt(total) + "</b> hotspots</span>" +
      "<span>" + topText + "</span>";
  }

  function stopPlayback() {
    isPlaying = false;
    setButtons();
    if (timer) { clearInterval(timer); timer = null; }
  }

  function stepYear(next) {
    const y = Math.min(YEARS[YEARS.length - 1], Math.max(YEARS[0], next));
    currentYear = y;
    updateYearUI();
    updateMetrics();
    if (embedResult && embedResult.view && typeof embedResult.view.signal === "function") {
      embedResult.view.signal("currentYear", currentYear);
      embedResult.view.runAsync();
    }
  }

  function startPlayback() {
    if (isPlaying) return;
    currentYear = Number(currentYear) || YEARS[0];
    if (currentYear >= YEARS[YEARS.length - 1]) stepYear(YEARS[0]);
    const idx = YEARS.indexOf(currentYear);
    if (idx < 0 || idx >= YEARS.length - 1) return;
    isPlaying = true;
    setButtons();
    timer = setInterval(function () {
      const i = YEARS.indexOf(currentYear);
      if (i >= YEARS.length - 1) { stopPlayback(); return; }
      stepYear(YEARS[i + 1]);
    }, 1000);
  }

  playBtn.addEventListener("click", startPlayback);
  pauseBtn.addEventListener("click", stopPlayback);
  restartBtn.addEventListener("click", function () { stopPlayback(); stepYear(YEARS[0]); });
  yearInput.addEventListener("input", function () { stopPlayback(); stepYear(Number(yearInput.value)); });

  // --- CSV parsing & sampling ---
  function reservoirPush(sample, row, seen, max) {
    if (sample.length < max) { sample.push(row); return; }
    const j = Math.floor(Math.random() * seen);
    if (j < max) sample[j] = row;
  }

  function parseHotspotRow(line, headers) {
    const cols = line.split(",");
    if (cols.length < headers.length) return null;
    const row = {};
    for (let i = 0; i < headers.length; i++) row[headers[i]] = cols[i];

    const acq_date = row.acq_date;
    if (!acq_date || acq_date.length < 4) return null;
    const year = +acq_date.slice(0, 4);
    if (!Number.isFinite(year) || year < 2014 || year > 2024) return null;

    const lat        = +row.latitude;
    const lon        = +row.longitude;
    const brightness = +row.brightness;
    const frp        = +row.frp;
    if (!Number.isFinite(lat) || !Number.isFinite(lon) || !Number.isFinite(brightness) || !Number.isFinite(frp)) return null;

    return {
      year, latitude: lat, longitude: lon, brightness, frp,
      acq_date,
      acq_time: (row.acq_time || "0000").padStart(4, "0")
    };
  }

  function topKByFrp(rows, k) {
    if (rows.length <= k) return rows.slice().sort(function (a, b) { return b.frp - a.frp; });
    const out = [];
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      if (out.length < k) {
        out.push(r);
        if (out.length === k) out.sort(function (a, b) { return a.frp - b.frp; });
      } else if (r.frp > out[0].frp) {
        out[0] = r;
        out.sort(function (a, b) { return a.frp - b.frp; });
      }
    }
    return out.sort(function (a, b) { return b.frp - a.frp; });
  }

  function prepareData(csvText) {
    const lines   = csvText.split(/\r?\n/);
    const headers = lines[0].split(",").map(function (h) { return h.trim(); });

    const firesByYear      = {};
    const seenByYear       = {};
    const candidatesByYear = {};
    YEARS.forEach(function (y) {
      firesByYear[y] = []; seenByYear[y] = 0; candidatesByYear[y] = [];
      yearlyCounts[y] = 0; topEventByYear[y] = null;
    });

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      if (!line) continue;
      const row = parseHotspotRow(line, headers);
      if (!row) continue;

      const y = row.year;
      yearlyCounts[y] += 1;
      seenByYear[y]   += 1;
      reservoirPush(firesByYear[y], row, seenByYear[y], MAX_FIRES_PER_YEAR);

      const prev = topEventByYear[y];
      if (!prev || row.frp > prev.frp) topEventByYear[y] = row;

      const cand = candidatesByYear[y];
      if (cand.length < MAX_MAP_POINTS_YEAR * 2) cand.push(row);
      else if (row.frp > cand[cand.length - 1].frp) cand.push(row);
    }

    firesAll = [];
    mapAll   = [];
    YEARS.forEach(function (y) {
      const fires = firesByYear[y];
      for (let i = 0; i < fires.length; i++) firesAll.push(fires[i]);
      const mapPts = topKByFrp(fires, MAX_MAP_POINTS_YEAR);
      for (let i = 0; i < mapPts.length; i++) mapAll.push(mapPts[i]);
    });
  }

  // --- Vega-Lite spec ---
  function buildSpec(box) {
    if (!ntOutline) throw new Error("NT boundary not loaded");

    const gap     = 3;
    const layoutW = box.w;
    const layoutH = box.h;
    const sideW   = Math.max(64, Math.round(layoutW * 0.4));
    const mapW    = Math.max(72, layoutW - sideW - gap);
    const mapH    = Math.max(60, layoutH - 14);
    const histH   = Math.max(28, Math.floor((layoutH - gap - 12) / 2));
    const mapPad  = { left: 10, top: 10, right: 4, bottom: 6 };
    const mapShiftX = -18;

    const baseFilter = { filter: "datum.year == currentYear" };
    const ntValues   = [{ geometry: ntOutline.geometry, state: "Northern Territory" }];

    const mapSpec = {
      width:  mapW,
      height: mapH,
      padding: mapPad,
      projection: mapProjection(mapW, mapH, mapPad, mapShiftX),
      layer: [
        {
          data: { values: ntValues },
          mark: {
            type: "geoshape",
            clip: true,
            fill: "#434c5e",
            opacity: 0.92,
            stroke: "rgba(255,255,255,0.7)",
            strokeWidth: 1.3
          },
          encoding: { shape: { field: "geometry", type: "geojson" } }
        },
        {
          data: { name: "mapAll" },
          transform: [baseFilter],
          mark: { type: "circle", clip: true, tooltip: { content: "data" } },
          encoding: {
            longitude: { field: "longitude", type: "quantitative", axis: null },
            latitude:  { field: "latitude",  type: "quantitative", axis: null },
            size: {
              field: "frp",
              type: "quantitative",
              scale: { type: "sqrt", range: [10, 200], zero: false },
              legend: null
            },
            color: {
              field: "frp",
              type: "quantitative",
              scale: { scheme: "orangered", nice: true },
              legend: null
            },
            opacity: {
              field: "frp",
              type: "quantitative",
              scale: { range: [0.35, 0.95] },
              legend: null
            },
            tooltip: [
              { field: "acq_date",   title: "Date" },
              { field: "acq_time",   title: "Time (UTC)" },
              { field: "brightness", type: "quantitative", title: "Brightness (K)", format: ".1f" },
              { field: "frp",        type: "quantitative", title: "FRP (MW)",        format: ".1f" }
            ]
          }
        }
      ]
    };

    const annotX = Math.round(sideW * 0.46);
    // Approximate pixel position of the top of the tallest bar in each histogram.
    // FRP is right-skewed so the first (lowest) bin is tallest -- sits at the far left.
    // Brightness peaks around 310-330 K, which is ~20% into the x range, also near left.
    const frpDotX    = Math.round(sideW * 0.14);
    const brightDotX = Math.round(sideW * 0.18);
    const dotY       = Math.round(histH * 0.20);  // near top of plot area
    const lineEndY   = Math.round(histH * 0.12);

    const frpHist = {
      width:  sideW,
      height: histH,
      title:  { text: "FRP distribution", fontSize: 10, anchor: "start", offset: 0 },
      data:   { name: "firesAll" },
      layer: [
        {
          transform: [baseFilter],
          mark: { type: "bar", color: "#e85d2c" },
          encoding: {
            x: {
              field: "frp", type: "quantitative", bin: { maxbins: 14 },
              title: "FRP (MW)", axis: { tickCount: 3, grid: false, labelFontSize: 9, titleFontSize: 10 }
            },
            y: {
              aggregate: "count", type: "quantitative",
              title: "Hotspots", axis: { tickCount: 3, grid: true, labelFontSize: 9, titleFontSize: 10 }
            }
          }
        },
        {
          data: { values: [{}] },
          mark: { type: "rule", color: "#e85d2c", strokeWidth: 1.2, strokeDash: [4, 3] },
          encoding: {
            x:  { value: frpDotX },
            y:  { value: dotY },
            x2: { value: annotX },
            y2: { value: lineEndY }
          }
        },
        {
          data: { values: [{}] },
          mark: { type: "point", color: "#e85d2c", filled: true, size: 28, strokeWidth: 0 },
          encoding: {
            x: { value: frpDotX },
            y: { value: dotY }
          }
        },
        {
          data: { values: [{}] },
          mark: {
            type: "text", align: "left", baseline: "top",
            color: "rgba(246,239,230,0.72)", fontSize: 13, lineBreak: "\n", lineHeight: 13
          },
          encoding: {
            x:    { value: annotX + 4 },
            y:    { value: lineEndY - 2 },
            text: { value: "Right-skewed: most fires\nfall below 50 MW\nExtreme FRP events are rare" }
          }
        }
      ]
    };

    const brightHist = {
      width:  sideW,
      height: histH,
      title:  { text: "Brightness distribution", fontSize: 10, anchor: "start", offset: 0 },
      data:   { name: "firesAll" },
      layer: [
        {
          transform: [baseFilter],
          mark: { type: "bar", color: "#ffb020" },
          encoding: {
            x: {
              field: "brightness", type: "quantitative", bin: { maxbins: 14 },
              title: "Brightness (K)", axis: { tickCount: 3, grid: false, labelFontSize: 9, titleFontSize: 10 }
            },
            y: {
              aggregate: "count", type: "quantitative",
              title: "Hotspots", axis: { tickCount: 3, grid: true, labelFontSize: 9, titleFontSize: 10 }
            }
          }
        },
        {
          data: { values: [{}] },
          mark: { type: "rule", color: "#ffb020", strokeWidth: 1.2, strokeDash: [4, 3] },
          encoding: {
            x:  { value: brightDotX },
            y:  { value: dotY },
            x2: { value: annotX },
            y2: { value: lineEndY }
          }
        },
        {
          data: { values: [{}] },
          mark: { type: "point", color: "#ffb020", filled: true, size: 28, strokeWidth: 0 },
          encoding: {
            x: { value: brightDotX },
            y: { value: dotY }
          }
        },
        {
          data: { values: [{}] },
          mark: {
            type: "text", align: "left", baseline: "top",
            color: "rgba(246,239,230,0.72)", fontSize: 13, lineBreak: "\n", lineHeight: 13
          },
          encoding: {
            x:    { value: annotX + 4 },
            y:    { value: lineEndY - 2 },
            text: { value: "Peak cluster: 310-330 K\nHigh brightness signals\nhigh-intensity fire" }
          }
        }
      ]
    };

    return {
      $schema:    "https://vega.github.io/schema/vega-lite/v5.json",
      width:      layoutW,
      height:     layoutH,
      background: "transparent",
      padding:    0,
      params: [{ name: "currentYear", value: currentYear }],
      datasets: { firesAll, mapAll },
      config: {
        background: "transparent",
        view: {
          stroke: "rgba(255,255,255,0.08)",
          fill: "rgba(255,255,255,0.02)",
          cornerRadius: 4
        },
        title: { fontSize: 11, anchor: "start", offset: 2 },
        axis: {
          domainColor: "rgba(255,255,255,0.25)",
          gridColor:   "rgba(255,255,255,0.10)",
          labelColor:  "#d4d7dd",
          titleColor:  "#eef1f5",
          tickColor:   "rgba(255,255,255,0.25)"
        },
        legend: {
          labelColor: "#d4d7dd",
          titleColor: "#ffffff",
          labelFontSize: 10,
          titleFontSize: 11
        }
      },
      spacing: 2,
      hconcat: [
        mapSpec,
        { spacing: gap, vconcat: [frpHist, brightHist] }
      ]
    };
  }

  function teardown() {
    if (embedResult && embedResult.finalize) {
      try { embedResult.finalize(); } catch (e) {}
    }
    embedResult = null;
    vizEl.innerHTML = "";
  }

  function render() {
    teardown();
    // Pre-populate toolbar text so the toolbar reaches its final height
    // before vizBox() reads clientHeight - otherwise the SVG is sized to the
    // empty-metrics height and overflows once the metrics text appears.
    updateYearUI();
    updateMetrics();
    const box = vizBox();
    vegaEmbed(vizEl, buildSpec(box), { actions: false, tooltip: { theme: "dark" }, renderer: "svg" })
      .then(function (result) {
        embedResult = result;
        setButtons();
      })
      .catch(function (error) {
        vizEl.innerHTML = '<p style="color:#ffd6d6">Chart 4 failed: ' + error.message + "</p>";
      });
  }

  Promise.all([
    fetch(DATA_URL).then(function (res) {
      if (!res.ok) throw new Error("HTTP " + res.status + " for " + DATA_URL);
      return res.text();
    }),
    getNtOutline()
  ])
    .then(function (results) {
      prepareData(results[0]);
      requestAnimationFrame(function () {
        requestAnimationFrame(render);
      });
    })
    .catch(function (error) {
      vizEl.innerHTML =
        '<p style="color:#ffd6d6">Chart 4 failed to load data: ' + error.message +
        ". Run a local server (python3 -m http.server 8080).</p>";
    });

  function scheduleRender() {
    clearTimeout(window.__chart4ResizeTimer);
    window.__chart4ResizeTimer = setTimeout(function () {
      const y = currentYear;
      render();
      setTimeout(function () {
        currentYear = y;
        updateYearUI();
        updateMetrics();
        if (embedResult && embedResult.view) {
          embedResult.view.signal("currentYear", currentYear).runAsync();
        }
      }, 0);
    }, 200);
  }

  window.addEventListener("resize", scheduleRender, { passive: true });

  const chart4Body = chartContainer.querySelector(".chart4-body");
  if (chart4Body && typeof ResizeObserver !== "undefined") {
    new ResizeObserver(scheduleRender).observe(chart4Body);
  }
})();
