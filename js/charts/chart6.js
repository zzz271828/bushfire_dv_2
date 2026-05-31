/**
 * Chart 6 -- Bubble scatter: brightness x FRP, sized by scan area
 *
 * Animation: Play cycles through intensity tiers cumulatively --
 *   Step 0: Low only          (axes fit to Low data)
 *   Step 1: Low + Moderate    (axes expand)
 *   Step 2: Low + Moderate + High (axes expand)
 *   Step 3: All tiers         (full graph)
 *
 * Filter: click a category button -> detail scatter appears (right panel)
 *   with axes auto-fitted to that group's brightness/FRP range.
 *
 * Interactions: scroll=zoom, drag=pan, click tier=highlight/dim
 * Analytics: OLS regression line (full dataset), Pearson r label
 * Annotations: max FRP point, densest cluster centroid, largest scan area
 */
(function () {
  if (window.__chart6Initialized) return;
  window.__chart6Initialized = true;

  var DATA_URL = "datasets/northern_territory_hotspots.csv";
  var el = document.getElementById("chart6");
  if (!el || typeof vegaEmbed === "undefined") return;

  var DIM_TEXT = "rgba(246,239,230,0.38)";
  var MID_TEXT = "rgba(246,239,230,0.62)";

  var CAT_DOMAIN = ["Low", "Moderate", "High", "Extreme"];
  var CAT_COLORS = ["#5b9bd5", "#f3b24a", "#e85d2c", "#e0294a"];

  // -- Shared tooltip definition (used in both main and detail specs)
  var TOOLTIP = [
    { field: "brightness", title: "Brightness (K)",  type: "quantitative", format: ".1f" },
    { field: "frp",        title: "FRP (MW)",        type: "quantitative", format: ".1f" },
    { field: "scan",       title: "Scan area (km²)", type: "quantitative", format: ".2f" },
    { field: "acq_date",   title: "Date",            type: "nominal" },
    { field: "acq_time",   title: "Time",            type: "nominal" },
    { field: "category",   title: "Intensity",       type: "nominal" }
  ];

  // -- State ----------------------------------------------------------------
  var embedRes      = null;
  var embedDetail   = null;
  var resizeTimer   = null;
  var chartData     = null;
  var chartStats    = null;
  var lastBox       = { w: 0, h: 0 };
  var lastDetailBox = { w: 0, h: 0 };

  // Animation state
  // currentLevel: -1 = All visible, 0=Low, 1=+Moderate, 2=+High, 3=full graph
  var currentLevel = -1;
  var isPlaying    = false;
  var playTimer    = null;

  // Filter/detail state
  var selectedCat  = null; // null = All, or "Low"|"Moderate"|"High"|"Extreme"

  // -- Animation helpers ----------------------------------------------------
  function levelLabel(level) {
    if (level < 0 || level >= CAT_DOMAIN.length - 1) return "All";
    return CAT_DOMAIN[level];
  }
  function levelDotColor(level) {
    return (level < 0 || level >= CAT_DOMAIN.length - 1)
      ? "rgba(246,239,230,0.45)"
      : CAT_COLORS[level];
  }

  // -- Toolbar HTML ---------------------------------------------------------
  el.innerHTML = [
    '<div class="c6-toolbar">',
    '  <div class="c6-controls">',
    '    <button class="c6-btn" id="c6Play"    type="button">&#9654; Play</button>',
    '    <button class="c6-btn" id="c6Pause"   type="button" disabled>&#9646;&#9646; Pause</button>',
    '    <button class="c6-btn" id="c6Restart" type="button">&#8635; Restart</button>',
    '    <span class="c6-cat-label">',
    '      Showing: <span id="c6CatDot" style="color:rgba(246,239,230,0.45)">&#11044;</span>',
    '      <b id="c6CatValue">All</b>',
    '    </span>',
    '  </div>',
    '  <div class="c6-controls" id="c6FilterRow">',
    '    <span style="font-size:10px;color:rgba(246,239,230,0.45);letter-spacing:0.05em;">Detail:</span>',
    '    <button class="c6-btn" id="c6FAll" data-cat="" data-cat-color="#e85d2c">All</button>',
    CAT_DOMAIN.map(function (cat, i) {
      return '    <button class="c6-btn" data-cat="' + cat +
             '" data-cat-color="' + CAT_COLORS[i] + '">' + cat + '</button>';
    }).join(""),
    '  </div>',
    '</div>',
    '<div class="chart6-body" id="chart6Body">',
    '  <div id="chart6Viz">',
    '    <div style="height:100%;display:flex;align-items:center;justify-content:center;',
    '      color:rgba(246,239,230,0.32);font-size:13px;font-family:Inter,system-ui,sans-serif;">',
    '      Loading hotspot data...</div>',
    '  </div>',
    '  <div class="c6-detail-panel" id="chart6DetailPanel">',
    '    <div id="chart6Detail"></div>',
    '  </div>',
    '</div>'
  ].join("");

  // -- Playback helpers -----------------------------------------------------
  function setButtons() {
    var pb = document.getElementById("c6Play");
    var sb = document.getElementById("c6Pause");
    if (pb) pb.disabled = isPlaying;
    if (sb) sb.disabled = !isPlaying;
  }

  function stepLevel(level) {
    currentLevel = level;
    var dotEl = document.getElementById("c6CatDot");
    var valEl = document.getElementById("c6CatValue");
    if (dotEl) dotEl.style.color = levelDotColor(level);
    if (valEl) valEl.textContent = levelLabel(level);
    if (embedRes && embedRes.view) {
      embedRes.view.signal("currentLevel", level).runAsync();
    }
  }

  function stopPlayback() {
    isPlaying = false;
    setButtons();
    if (playTimer) { clearInterval(playTimer); playTimer = null; }
  }

  function startPlayback() {
    if (isPlaying) return;
    if (currentLevel >= CAT_DOMAIN.length - 1) stepLevel(-1);
    isPlaying = true;
    setButtons();
    playTimer = setInterval(function () {
      var next = currentLevel + 1;
      if (next > CAT_DOMAIN.length - 1) {
        stepLevel(CAT_DOMAIN.length - 1);
        stopPlayback();
        return;
      }
      stepLevel(next);
    }, 1500);
  }

  (function bindButtons() {
    var pb = document.getElementById("c6Play");
    var sb = document.getElementById("c6Pause");
    var rb = document.getElementById("c6Restart");
    if (pb) pb.addEventListener("click", startPlayback);
    if (sb) sb.addEventListener("click", stopPlayback);
    if (rb) rb.addEventListener("click", function () { stopPlayback(); stepLevel(-1); });
  })();

  // -- Filter button helpers ------------------------------------------------
  function setFilterButtonStyles() {
    document.querySelectorAll("#c6FilterRow .c6-btn").forEach(function (btn) {
      var cat = btn.dataset.cat || null;
      var isActive = cat === selectedCat;
      if (isActive) {
        var color = btn.dataset.catColor || "#e85d2c";
        btn.style.borderColor = color;
        btn.style.color = color;
        btn.style.background = "rgba(255,255,255,0.09)";
        btn.style.fontWeight = "700";
      } else {
        btn.style.borderColor = "";
        btn.style.color = "";
        btn.style.background = "";
        btn.style.fontWeight = "";
      }
    });
  }

  function selectCategory(cat) {
    selectedCat = cat || null;
    setFilterButtonStyles();

    var bodyEl  = document.getElementById("chart6Body");
    var panelEl = document.getElementById("chart6DetailPanel");

    if (selectedCat) {
      if (bodyEl)  bodyEl.classList.add("c6-split");
      if (panelEl) panelEl.style.display = "";  // CSS class handles flex
    } else {
      if (bodyEl)  bodyEl.classList.remove("c6-split");
      if (panelEl) panelEl.style.display = "none";
      teardownDetail();
    }

    // Force re-layout: reset size guards so both charts re-render at new widths
    lastBox       = { w: 0, h: 0 };
    lastDetailBox = { w: 0, h: 0 };

    // Use rAF so the DOM has applied the class/flex changes before we measure
    requestAnimationFrame(function () {
      render();
      if (selectedCat) renderDetail();
    });
  }

  (function bindFilterButtons() {
    var row = document.getElementById("c6FilterRow");
    if (!row) return;
    row.addEventListener("click", function (e) {
      var btn = e.target.closest(".c6-btn");
      if (!btn) return;
      var cat = btn.dataset.cat || null;
      if (cat === selectedCat) return; // already selected, do nothing
      selectCategory(cat);
    });
  })();

  // -- Utilities ------------------------------------------------------------
  function sample(rows, n) {
    if (rows.length <= n) return rows;
    var r = rows.slice(0, n);
    for (var i = n; i < rows.length; i++) {
      var j = Math.floor(Math.random() * (i + 1));
      if (j < n) r[j] = rows[i];
    }
    return r;
  }

  function parseCsv(text) {
    var lines   = text.split(/\r?\n/);
    var headers = lines[0].split(",").map(function (h) { return h.trim(); });
    var rows = [];
    for (var i = 1; i < lines.length; i++) {
      if (!lines[i].trim()) continue;
      var cols = lines[i].split(",");
      var row  = {};
      headers.forEach(function (h, j) { row[h] = (cols[j] || "").trim(); });
      rows.push(row);
    }
    return rows;
  }

  function pctile(sorted, p) {
    return sorted[Math.min(Math.floor(sorted.length * p), sorted.length - 1)];
  }

  function pearsonR(data) {
    var n = 0, sX = 0, sY = 0, sXY = 0, sX2 = 0, sY2 = 0;
    for (var i = 0; i < data.length; i++) {
      var x = data[i].brightness, y = data[i].frp;
      if (!isFinite(x) || !isFinite(y)) continue;
      n++; sX += x; sY += y; sXY += x * y; sX2 += x * x; sY2 += y * y;
    }
    if (n < 2) return 0;
    var num = n * sXY - sX * sY;
    var den = Math.sqrt((n * sX2 - sX * sX) * (n * sY2 - sY * sY));
    return den === 0 ? 0 : num / den;
  }

  // -- Data processing ------------------------------------------------------
  function processData(rows) {
    var valid = rows.filter(function (d) {
      return +d.brightness > 0 && +d.frp > 0 && +d.frp < 3000 && +d.scan > 0;
    });

    var raw = sample(valid, 900);

    var frpSorted = raw.map(function (d) { return +d.frp; })
                       .sort(function (a, b) { return a - b; });
    var q25 = pctile(frpSorted, 0.25);
    var q50 = pctile(frpSorted, 0.50);
    var q75 = pctile(frpSorted, 0.75);
    var q99 = pctile(frpSorted, 0.99);

    var data = raw.map(function (d) {
      var f = +d.frp, b = +d.brightness, s = +d.scan;
      var order = f < q25 ? 0 : f < q50 ? 1 : f < q75 ? 2 : 3;
      return {
        brightness:    b,
        frp:           f,
        brightness_j:  b + (Math.random() - 0.5) * 2.0,
        frp_j:         f + (Math.random() - 0.5) * 0.8,
        scan:          s,
        acq_date:      d.acq_date,
        acq_time:      d.acq_time,
        category:      CAT_DOMAIN[order],
        categoryOrder: order
      };
    }).filter(function (d) { return d.frp < q99; });

    var r = pearsonR(data);

    var maxFrpPt = data.reduce(function (a, b) { return b.frp > a.frp ? b : a; });

    var bVals = data.map(function (d) { return d.brightness; });
    var bMin  = Math.min.apply(null, bVals);
    var bMax  = Math.max.apply(null, bVals);
    var BINS  = 10;
    var bStep = ((bMax - bMin) / BINS) || 1;
    var fStep = (q75 / BINS) || 1;
    var grid  = {};
    data.forEach(function (d) {
      if (d.frp > q75) return;
      var bi  = Math.min(BINS - 1, Math.floor((d.brightness - bMin) / bStep));
      var fi  = Math.min(BINS - 1, Math.floor(d.frp / fStep));
      var key = bi + "_" + fi;
      if (!grid[key]) grid[key] = { count: 0, bSum: 0, fSum: 0 };
      grid[key].count++;
      grid[key].bSum += d.brightness;
      grid[key].fSum += d.frp;
    });
    var best = { count: 0, bSum: 0, fSum: 0 };
    Object.keys(grid).forEach(function (k) {
      if (grid[k].count > best.count) best = grid[k];
    });
    var clusterPt = {
      brightness: best.count > 0 ? best.bSum / best.count : bMin + (bMax - bMin) * 0.3,
      frp:        best.count > 0 ? best.fSum / best.count : q25
    };

    var maxScanPt = data.reduce(function (a, b) { return b.scan > a.scan ? b : a; });

    return {
      data:  data,
      stats: { r: r, q99: q99, maxFrpPt: maxFrpPt, clusterPt: clusterPt, maxScanPt: maxScanPt }
    };
  }

  // -- Shared axis config ---------------------------------------------------
  var AX = {
    labelColor:      "rgba(246,239,230,0.50)",
    titleColor:      "rgba(246,239,230,0.55)",
    gridColor:       "rgba(255,255,255,0.05)",
    domainColor:     "rgba(255,255,255,0.12)",
    tickColor:       "rgba(255,255,255,0.12)",
    labelFontSize:   10,
    titleFontSize:   11,
    titleFontWeight: 500,
    tickCount:       6
  };

  function baseCfg() {
    return {
      background: "transparent",
      view: { stroke: "rgba(255,255,255,0.07)", fill: "rgba(255,255,255,0.012)", cornerRadius: 4 },
      font: "Inter, system-ui, -apple-system, sans-serif",
      axis: AX
    };
  }

  // -- Main scatter spec ----------------------------------------------------
  function buildSpec(data, stats, box, level) {
    var w = Math.max(300, box.w - 180);
    var h = Math.max(220, box.h - 60);

    var xEnc = {
      field: "brightness_j", type: "quantitative",
      scale: { zero: false },
      axis: Object.assign({ title: "Brightness (K)" }, AX)
    };
    var yEnc = {
      field: "frp_j", type: "quantitative",
      scale: { zero: true },
      axis: Object.assign({ title: "FRP (MW)" }, AX)
    };

    // Layer 1 -- scatter, cumulative filter
    var scatter = {
      transform: [
        { filter: "currentLevel < 0 || datum.categoryOrder <= currentLevel" }
      ],
      params: [
        { name: "grid",    select: { type: "interval", bind: "scales", encodings: ["x", "y"] } },
        { name: "cat_sel", select: { type: "point",    fields: ["category"] } }
      ],
      mark: { type: "circle", stroke: "rgba(255,255,255,0.18)", strokeWidth: 0.5 },
      encoding: {
        x: xEnc,
        y: yEnc,
        size: {
          field: "scan", type: "quantitative",
          scale: { range: [10, 280], zero: false },
          legend: {
            title: "Scan (km²)", titleColor: MID_TEXT, labelColor: DIM_TEXT,
            titleFontSize: 10, labelFontSize: 9, orient: "right", offset: 10
          }
        },
        color: {
          field: "category", type: "nominal",
          scale: { domain: CAT_DOMAIN, range: CAT_COLORS },
          legend: {
            title: "Fire intensity", titleColor: MID_TEXT, labelColor: MID_TEXT,
            titleFontSize: 10, labelFontSize: 10, symbolSize: 100,
            orient: "right", offset: 10
          }
        },
        opacity: {
          condition: { param: "cat_sel", value: 0.40 },
          value: 0.07
        },
        tooltip: TOOLTIP
      }
    };

    // Layer 2 -- OLS regression on full dataset (stable reference line)
    var regLine = {
      transform: [{ regression: "frp", on: "brightness" }],
      mark: {
        type: "line", color: "rgba(246,239,230,0.65)",
        strokeDash: [6, 3], strokeWidth: 2.0, tooltip: false
      },
      encoding: {
        x: { field: "brightness", type: "quantitative" },
        y: { field: "frp",        type: "quantitative" }
      }
    };

    // Layer 3 -- Pearson r label
    var rStr = (stats.r >= 0 ? "+" : "") + stats.r.toFixed(3);
    var corrLabel = {
      data: { values: [{}] },
      mark: { type: "text", align: "left", baseline: "top", fontSize: 11, fontWeight: 500 },
      encoding: {
        x:    { value: 10 },
        y:    { value:  8 },
        text: { value: "Pearson r = " + rStr + "  (brightness vs FRP)" },
        color:{ value: MID_TEXT }
      }
    };

    // Layer 4 -- max FRP dot
    var maxFrpDot = {
      data: { values: [{ brightness: stats.maxFrpPt.brightness, frp: stats.maxFrpPt.frp }] },
      mark: { type: "point", filled: true, fill: "#e0294a", stroke: "#ffffff", strokeWidth: 0.8, size: 90, opacity: 1 },
      encoding: {
        x: { field: "brightness", type: "quantitative" },
        y: { field: "frp",        type: "quantitative" }
      }
    };

    // Layer 5 -- max FRP text
    var maxFrpText = {
      data: { values: [{ brightness: stats.maxFrpPt.brightness, frp: stats.maxFrpPt.frp }] },
      mark: { type: "text", align: "left", dx: 9, dy: -3, fontSize: 9.5, fontWeight: 600 },
      encoding: {
        x:    { field: "brightness", type: "quantitative" },
        y:    { field: "frp",        type: "quantitative" },
        text: { value: "Max FRP -" + Math.round(stats.maxFrpPt.frp) + " MW" },
        color:{ value: "#e0294a" }
      }
    };

    // Layer 6 -- densest cluster label
    var clusterText = {
      data: { values: [{ brightness: stats.clusterPt.brightness, frp: stats.clusterPt.frp }] },
      mark: { type: "text", align: "center", dy: -14, fontSize: 9.5, fontStyle: "italic", fontWeight: 500 },
      encoding: {
        x:    { field: "brightness", type: "quantitative" },
        y:    { field: "frp",        type: "quantitative" },
        text: { value: "Densest cluster" },
        color:{ value: "rgba(246,239,230,0.48)" }
      }
    };

    // Layer 7 -- largest scan dot
    var maxScanDot = {
      data: { values: [{ brightness: stats.maxScanPt.brightness, frp: stats.maxScanPt.frp }] },
      mark: { type: "point", filled: true, fill: "#5b9bd5", stroke: "#ffffff", strokeWidth: 0.8, size: 90, opacity: 0.9 },
      encoding: {
        x: { field: "brightness", type: "quantitative" },
        y: { field: "frp",        type: "quantitative" }
      }
    };

    // Layer 8 -- largest scan text
    var maxScanText = {
      data: { values: [{ brightness: stats.maxScanPt.brightness, frp: stats.maxScanPt.frp }] },
      mark: { type: "text", align: "right", dx: -9, dy: 3, fontSize: 9.5, fontWeight: 500 },
      encoding: {
        x:    { field: "brightness", type: "quantitative" },
        y:    { field: "frp",        type: "quantitative" },
        text: { value: "Largest scan -" + stats.maxScanPt.scan.toFixed(1) + " km²" },
        color:{ value: "#5b9bd5" }
      }
    };

    return {
      $schema:    "https://vega.github.io/schema/vega-lite/v5.json",
      background: "transparent",
      config:     baseCfg(),
      params:     [{ name: "currentLevel", value: level }],
      data:       { values: data },
      width:      w,
      height:     h,
      layer: [
        scatter, regLine, corrLabel,
        maxFrpDot, maxFrpText, clusterText,
        maxScanDot, maxScanText
      ]
    };
  }

  // -- Detail scatter spec --------------------------------------------------
  function buildDetailSpec(filteredData, box, catName, catColor) {
    // Axes auto-fit to the filtered group (zero: false compresses to the group's range)
    var w = Math.max(160, box.w - 90); // space for scan legend on right
    var h = Math.max(180, box.h - 60);

    var catR = pearsonR(filteredData);
    var rStr = (catR >= 0 ? "+" : "") + catR.toFixed(3);

    var scatter = {
      params: [
        { name: "d_grid", select: { type: "interval", bind: "scales", encodings: ["x", "y"] } }
      ],
      mark: { type: "circle", stroke: "rgba(255,255,255,0.22)", strokeWidth: 0.6 },
      encoding: {
        x: {
          field: "brightness_j", type: "quantitative",
          scale: { zero: false },
          axis: Object.assign({ title: "Brightness (K)" }, AX)
        },
        y: {
          field: "frp_j", type: "quantitative",
          scale: { zero: false },
          axis: Object.assign({ title: "FRP (MW)" }, AX)
        },
        color: { value: catColor },
        opacity: { value: 0.55 },
        size: {
          field: "scan", type: "quantitative",
          scale: { range: [8, 160], zero: false },
          legend: {
            title: "Scan (km²)", titleColor: MID_TEXT, labelColor: DIM_TEXT,
            titleFontSize: 9, labelFontSize: 8, orient: "right", offset: 6
          }
        },
        tooltip: TOOLTIP
      }
    };

    // OLS regression for this group only
    var regLine = {
      transform: [{ regression: "frp", on: "brightness" }],
      mark: {
        type: "line", color: "rgba(246,239,230,0.70)",
        strokeDash: [5, 3], strokeWidth: 1.8, tooltip: false
      },
      encoding: {
        x: { field: "brightness", type: "quantitative" },
        y: { field: "frp",        type: "quantitative" }
      }
    };

    // r label + count in top-left
    var rLabel = {
      data: { values: [{}] },
      mark: { type: "text", align: "left", baseline: "top", fontSize: 10, fontWeight: 500 },
      encoding: {
        x:    { value: 6 },
        y:    { value: 4 },
        text: { value: catName + " - r = " + rStr + "  (n = " + filteredData.length + ")" },
        color:{ value: MID_TEXT }
      }
    };

    return {
      $schema:    "https://vega.github.io/schema/vega-lite/v5.json",
      background: "transparent",
      config:     baseCfg(),
      title: {
        text:       catName + " intensity - detail view",
        fontSize:   11,
        fontWeight: 600,
        anchor:     "start",
        color:      catColor,
        offset:     4
      },
      data:   { values: filteredData },
      width:  w,
      height: h,
      layer:  [scatter, regLine, rLabel]
    };
  }

  // -- Render lifecycle -----------------------------------------------------
  function teardown() {
    if (embedRes && typeof embedRes.finalize === "function") {
      try { embedRes.finalize(); } catch (e) {}
    }
    embedRes = null;
  }

  function teardownDetail() {
    if (embedDetail && typeof embedDetail.finalize === "function") {
      try { embedDetail.finalize(); } catch (e) {}
    }
    embedDetail = null;
    var detEl = document.getElementById("chart6Detail");
    if (detEl) detEl.innerHTML = "";
  }

  function vizBox() {
    var frame  = el.parentElement;
    var bodyEl = document.getElementById("chart6Body");
    var totalW = Math.max(360, (frame ? frame.clientWidth : el.clientWidth) || 800);
    var h      = Math.max(280, (bodyEl ? bodyEl.clientHeight : el.clientHeight) || 520);
    var w      = selectedCat ? Math.floor(totalW * 0.55) : totalW;
    return { w: w, h: h };
  }

  function detailBox() {
    var frame  = el.parentElement;
    var bodyEl = document.getElementById("chart6Body");
    var totalW = Math.max(360, (frame ? frame.clientWidth : el.clientWidth) || 800);
    var h      = Math.max(280, (bodyEl ? bodyEl.clientHeight : el.clientHeight) || 520);
    var w      = Math.max(200, totalW - Math.floor(totalW * 0.55) - 12);
    return { w: w, h: h };
  }

  function render() {
    if (!chartData) return;
    var box = vizBox();
    if (Math.abs(box.w - lastBox.w) < 4 && Math.abs(box.h - lastBox.h) < 4) return;
    lastBox = { w: box.w, h: box.h };
    teardown();
    var vizEl = document.getElementById("chart6Viz");
    if (!vizEl) return;
    var spec = buildSpec(chartData, chartStats, box, currentLevel);
    vegaEmbed(vizEl, spec, { actions: false, tooltip: { theme: "dark" }, renderer: "svg" })
      .then(function (r) { embedRes = r; setButtons(); })
      .catch(function (err) {
        vizEl.innerHTML =
          '<p style="color:#ffd6d6;padding:12px;font-family:monospace">Chart 6: ' +
          err.message + "</p>";
      });
  }

  function renderDetail() {
    if (!chartData || !selectedCat) return;
    var dbox = detailBox();
    if (Math.abs(dbox.w - lastDetailBox.w) < 4 && Math.abs(dbox.h - lastDetailBox.h) < 4) return;
    lastDetailBox = { w: dbox.w, h: dbox.h };

    var catIdx      = CAT_DOMAIN.indexOf(selectedCat);
    var catColor    = CAT_COLORS[catIdx] || "#e85d2c";
    var filteredData = chartData.filter(function (d) { return d.category === selectedCat; });

    teardownDetail();
    var detEl = document.getElementById("chart6Detail");
    if (!detEl) return;

    if (filteredData.length === 0) {
      detEl.innerHTML =
        '<p style="color:rgba(246,239,230,0.4);font-size:12px;font-family:monospace">' +
        'No data for ' + selectedCat + '</p>';
      return;
    }

    var spec = buildDetailSpec(filteredData, dbox, selectedCat, catColor);
    vegaEmbed(detEl, spec, { actions: false, tooltip: { theme: "dark" }, renderer: "svg" })
      .then(function (r) { embedDetail = r; })
      .catch(function (err) {
        detEl.innerHTML =
          '<p style="color:#ffd6d6;padding:8px;font-family:monospace">Detail: ' +
          err.message + "</p>";
      });
  }

  function scheduleRender() {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () {
      render();
      if (selectedCat) renderDetail();
    }, 250);
  }

  // -- Bootstrap ------------------------------------------------------------
  var frameEl = el.parentElement;
  window.addEventListener("resize", scheduleRender, { passive: true });
  if (frameEl && typeof ResizeObserver !== "undefined") {
    new ResizeObserver(scheduleRender).observe(frameEl);
  }

  // Init filter buttons visual state ("All" active by default)
  setFilterButtonStyles();

  fetch(DATA_URL)
    .then(function (res) {
      if (!res.ok) throw new Error("HTTP " + res.status);
      return res.text();
    })
    .then(function (text) {
      var rows   = parseCsv(text);
      var result = processData(rows);
      chartData  = result.data;
      chartStats = result.stats;
      requestAnimationFrame(function () {
        requestAnimationFrame(function () {
          render();
          if (selectedCat) renderDetail();
        });
      });
    })
    .catch(function (err) {
      var vizEl = document.getElementById("chart6Viz") || el;
      vizEl.innerHTML =
        '<p style="color:#ffd6d6;padding:16px;font-family:monospace">Chart 6 failed: ' +
        err.message + " &mdash; serve over a local HTTP server.</p>";
    });
})();
