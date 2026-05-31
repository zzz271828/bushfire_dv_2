/**
 * Chart 5 - Waffle chart: time-of-day distribution, year-selectable (2014-2024).
 * 6 windows: Late Night (00-03), Early Morning (04-07), Morning (08-11),
 *            Afternoon (12-15), Evening (16-19), Night (20-23).
 * Year slider identical in style to Chart 1.
 */
(function () {
  if (window.__chart5Initialized) return;
  window.__chart5Initialized = true;

  const DATA_URL = "datasets/northern_territory_hotspots.csv";
  const YEARS = [];
  for (var y = 2014; y <= 2024; y++) YEARS.push(y);

  const chartContainer = document.getElementById("chart5");
  if (!chartContainer || typeof vegaEmbed === "undefined") return;

  const ORDER = ["Late Night", "Early Morning", "Morning", "Afternoon", "Evening", "Night"];
  const COLORS = {
    "Late Night":    "#4f6f88",
    "Early Morning": "#7d9bb5",
    "Morning":       "#f3b24a",
    "Afternoon":     "#ef6a1c",
    "Evening":       "#cf4117",
    "Night":         "#8a4733"
  };
  const WINDOWS = {
    "Late Night":    "00:00-03:59",
    "Early Morning": "04:00-07:59",
    "Morning":       "08:00-11:59",
    "Afternoon":     "12:00-15:59",
    "Evening":       "16:00-19:59",
    "Night":         "20:00-23:59"
  };

  function hourToWindow(hour) {
    if (hour < 4)  return "Late Night";
    if (hour < 8)  return "Early Morning";
    if (hour < 12) return "Morning";
    if (hour < 16) return "Afternoon";
    if (hour < 20) return "Evening";
    return "Night";
  }

  chartContainer.innerHTML = [
    '<div class="chart5-toolbar">',
    '  <label class="chart5-year-label" for="c5Year">Year <span id="c5YearValue">2023</span></label>',
    '  <input id="c5Year" type="range" min="2014" max="2024" step="1" value="2023" />',
    "</div>",
    '<div class="chart5-body">',
    '  <div id="chart5Viz"></div>',
    "</div>"
  ].join("");

  var yearInput   = document.getElementById("c5Year");
  var yearValue   = document.getElementById("c5YearValue");
  var vizEl       = document.getElementById("chart5Viz");
  var frameEl     = chartContainer.parentElement;
  var embedResult = null;
  var lastSize    = { width: 0, height: 0 };
  var currentYear = 2023;
  var perYearData = null;

  /* ---- data parsing ---- */
  function parseData(csvText) {
    var lines   = csvText.split(/\r?\n/);
    var headers = lines[0].split(",").map(function (h) { return h.trim(); });
    var idxDate = headers.indexOf("acq_date");
    var idxTime = headers.indexOf("acq_time");
    if (idxDate < 0) return;

    var result = {};
    YEARS.forEach(function (yr) {
      result[yr] = { total: 0, counts: {} };
      ORDER.forEach(function (w) { result[yr].counts[w] = 0; });
    });

    for (var i = 1; i < lines.length; i++) {
      if (!lines[i]) continue;
      var cols     = lines[i].split(",");
      var acqDate  = (cols[idxDate] || "").trim();
      if (!acqDate || acqDate.length < 4) continue;
      var yr = +acqDate.slice(0, 4);
      if (yr < 2014 || yr > 2024) continue;

      var timeStr = idxTime >= 0 ? (cols[idxTime] || "").trim() : "0";
      var padded  = timeStr.padStart(4, "0");
      var hour    = parseInt(padded.slice(0, 2), 10);
      if (!Number.isFinite(hour) || hour > 23) continue;

      result[yr].total++;
      result[yr].counts[hourToWindow(hour)]++;
    }

    perYearData = result;
  }

  /* ---- waffle square allocation ---- */
  function buildWaffleData(year) {
    var yd    = (perYearData && perYearData[year]) || { total: 0, counts: {} };
    var total = yd.total;
    var cells = 100;

    // Largest-remainder proportional rounding so squares always sum to 100.
    var raw = ORDER.map(function (w) {
      var count = yd.counts[w] || 0;
      var exact = total > 0 ? (count / total) * cells : 0;
      return { win: w, count: count, floor: Math.floor(exact), rem: exact - Math.floor(exact) };
    });
    var assigned  = raw.reduce(function (s, r) { return s + r.floor; }, 0);
    var remaining = cells - assigned;
    raw.slice().sort(function (a, b) { return b.rem - a.rem; })
       .forEach(function (r) { if (remaining > 0) { r.floor++; remaining--; } });

    var squares = [];
    var idx = 0;
    raw.forEach(function (r) {
      var pct = total > 0 ? (r.count / total * 100).toFixed(1) : "0.0";
      for (var i = 0; i < r.floor; i++) {
        squares.push({
          id: idx, col: idx % 10, row: Math.floor(idx / 10),
          category: r.win, timeWindow: WINDOWS[r.win],
          count: r.count, pctLabel: pct + "%"
        });
        idx++;
      }
    });
    // Fill any rounding remainder with the largest category.
    if (idx < cells) {
      var biggest = raw.reduce(function (a, b) { return b.count > a.count ? b : a; });
      var bPct = total > 0 ? (biggest.count / total * 100).toFixed(1) : "0.0";
      while (idx < cells) {
        squares.push({
          id: idx, col: idx % 10, row: Math.floor(idx / 10),
          category: biggest.win, timeWindow: WINDOWS[biggest.win],
          count: biggest.count, pctLabel: bPct + "%"
        });
        idx++;
      }
    }

    return { squares: squares, total: total };
  }

  /* ---- sizing ---- */
  function chartSize() {
    var toolbar  = chartContainer.querySelector(".chart5-toolbar");
    var toolbarH = toolbar ? toolbar.offsetHeight : 44;
    var w = chartContainer.clientWidth  || (frameEl ? frameEl.clientWidth  - 36 : 420);
    var h = (chartContainer.clientHeight || (frameEl ? frameEl.clientHeight - 90 : 480)) - toolbarH;
    var useH = Math.max(240, Math.floor(h) - 8);
    var maxW = Math.floor(useH * 1.3);
    var useW = Math.min(Math.max(240, Math.floor(w) - 8), maxW);
    return { width: useW, height: useH };
  }

  /* ---- Vega-Lite spec ---- */
  function buildSpec(data, size) {
    return {
      $schema:    "https://vega.github.io/schema/vega-lite/v5.json",
      background: "transparent",
      width:      size.width,
      height:     size.height,
      autosize:   { type: "fit" },
      padding:    { left: 4, top: 4, right: 4, bottom: 4 },
      config: {
        background: "transparent",
        view:   { stroke: null, fill: "transparent" },
        font:   "system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif",
        legend: {
          labelColor:    "#ffffff",
          titleColor:    "#ffffff",
          labelFontSize: 10,
          titleFontSize: 10,
          padding:       8,
          rowPadding:    4
        }
      },
      data: { values: data.squares },
      mark: { type: "rect", cornerRadius: 2 },
      encoding: {
        x: {
          field: "col", type: "ordinal",
          scale: { domain: [0,1,2,3,4,5,6,7,8,9], paddingInner: 0.08, paddingOuter: 0.02 },
          axis:  null
        },
        y: {
          field: "row", type: "ordinal",
          scale: { domain: [9,8,7,6,5,4,3,2,1,0], paddingInner: 0.08, paddingOuter: 0.02 },
          axis:  null
        },
        fill: {
          field: "category",
          type:  "nominal",
          scale: { domain: ORDER, range: ORDER.map(function (w) { return COLORS[w]; }) },
          legend: {
            title:      "Time window (UTC)",
            orient:     "right",
            symbolType: "square",
            symbolSize: 120
          }
        },
        opacity: { value: 0.92 },
        tooltip: [
          { field: "category",   title: "Window"                },
          { field: "timeWindow", title: "Hours (UTC)"           },
          { field: "count",      title: "Hotspots", format: "," },
          { field: "pctLabel",   title: "Share"                 }
        ]
      }
    };
  }

  /* ---- render lifecycle ---- */
  function teardown() {
    if (embedResult && embedResult.finalize) {
      try { embedResult.finalize(); } catch (e) {}
    }
    embedResult = null;
    vizEl.innerHTML = "";
  }

  function render() {
    if (!perYearData) return;
    var size = chartSize();
    if (Math.abs(size.width  - lastSize.width)  < 4 &&
        Math.abs(size.height - lastSize.height) < 4) return;
    lastSize = { width: size.width, height: size.height };
    var data = buildWaffleData(currentYear);
    teardown();
    vegaEmbed(vizEl, buildSpec(data, size), {
      actions:  false,
      tooltip:  { theme: "dark" },
      renderer: "svg"
    })
      .then(function (result) { embedResult = result; })
      .catch(function (err) {
        vizEl.innerHTML = window.ChartError
          ? window.ChartError("Chart 05", err.message)
          : '<p class="chart56-error">Chart 5 failed: ' + err.message + "</p>";
      });
  }

  function setYear(y) {
    currentYear = y;
    yearValue.textContent = String(y);
    yearInput.value = String(y);
    lastSize = { width: 0, height: 0 };
    render();
  }

  yearInput.addEventListener("input", function () {
    setYear(Number(yearInput.value));
  });

  /* ---- initial load ---- */
  vizEl.innerHTML = window.ChartSkeleton
    ? window.ChartSkeleton("waffle", "Time of day \xb7 rendering")
    : '<p class="chart56-loading">Loading...</p>';

  fetch(DATA_URL)
    .then(function (res) {
      if (!res.ok) throw new Error("HTTP " + res.status);
      return res.text();
    })
    .then(function (text) {
      parseData(text);
      requestAnimationFrame(function () { requestAnimationFrame(render); });
    })
    .catch(function (err) {
      vizEl.innerHTML = window.ChartError
        ? window.ChartError("Chart 05", err.message + " - serve over a local HTTP server.")
        : '<p class="chart56-error">Chart 5 failed: ' + err.message + "</p>";
    });

  /* ---- resize handling ---- */
  function schedule() {
    clearTimeout(window.__chart5ResizeTimer);
    window.__chart5ResizeTimer = setTimeout(render, 200);
  }

  window.addEventListener("resize", schedule, { passive: true });
  // Observe chart-frame (CSS-fixed height) not chart-stage to avoid feedback loop.
  if (frameEl && typeof ResizeObserver !== "undefined") {
    new ResizeObserver(schedule).observe(frameEl);
  }
})();
