/**
 * Chart 7 - Population Pyramid: fire intensity split by year (2014-2024).
 * Left side  = low / moderate intensity  (FRP < 50 MW)
 * Right side = high intensity            (FRP >= 50 MW)
 * Static chart -- no year animation.
 */
(function () {
  if (window.__chart7Initialized) return;
  window.__chart7Initialized = true;

  const FRP_THRESHOLD = 50;

  const YEARS = [];
  for (var y = 2014; y <= 2024; y++) YEARS.push(y);

  const DATA_URL = "datasets/northern_territory_hotspots.csv";

  const chartContainer = document.getElementById("chart7");
  if (!chartContainer || typeof vegaEmbed === "undefined") return;

  chartContainer.innerHTML = [
    '<div class="chart4-body">',
    '  <div id="chart7Viz"></div>',
    "</div>"
  ].join("");

  var vizEl = chartContainer.querySelector("#chart7Viz");
  var embedResult = null;
  var pyramidData = [];

  function prepareData(csvText) {
    var lines   = csvText.split(/\r?\n/);
    var headers = lines[0].split(",").map(function (h) { return h.trim(); });
    var idxDate = headers.indexOf("acq_date");
    var idxFrp  = headers.indexOf("frp");
    var idxLat  = headers.indexOf("latitude");
    var idxLon  = headers.indexOf("longitude");
    if (idxDate < 0 || idxFrp < 0) return;

    var lowByYear  = {};
    var highByYear = {};
    YEARS.forEach(function (y) { lowByYear[y] = 0; highByYear[y] = 0; });

    for (var i = 1; i < lines.length; i++) {
      if (!lines[i]) continue;
      var cols = lines[i].split(",");
      if (cols.length <= Math.max(idxDate, idxFrp)) continue;

      var acq_date = (cols[idxDate] || "").trim();
      if (!acq_date || acq_date.length < 4) continue;
      var yr = +acq_date.slice(0, 4);
      if (yr < 2014 || yr > 2024) continue;

      var frp = +cols[idxFrp];
      var lat = idxLat >= 0 ? +cols[idxLat] : NaN;
      var lon = idxLon >= 0 ? +cols[idxLon] : NaN;
      if (!Number.isFinite(frp) || !Number.isFinite(lat) || !Number.isFinite(lon)) continue;

      if (frp >= FRP_THRESHOLD) highByYear[yr]++;
      else                      lowByYear[yr]++;
    }

    pyramidData = [];
    var maxCount = 0;
    YEARS.forEach(function (yr) {
      pyramidData.push({ year: yr, risk: "Low / Moderate", count: lowByYear[yr]  });
      pyramidData.push({ year: yr, risk: "High",           count: highByYear[yr] });
      if (lowByYear[yr]  > maxCount) maxCount = lowByYear[yr];
      if (highByYear[yr] > maxCount) maxCount = highByYear[yr];
    });
    // Round up to nearest 10k for clean axis ticks
    pyramidData._maxCount = Math.ceil(maxCount / 10000) * 10000;
  }

  function vizBox() {
    return {
      w: Math.max(200, Math.floor(chartContainer.clientWidth  || 600)),
      h: Math.max(180, Math.floor(chartContainer.clientHeight || 440) - 20)
    };
  }

  function buildSpec(box) {
    var halfW    = Math.max(120, Math.floor((box.w - 6) / 2));
    var h        = Math.max(160, box.h);
    var axisDom  = pyramidData._maxCount || 90000;
    // Pixel estimates for annotation anchors (11 rows, 2023 = 10th from top = index 9)
    var y2023    = Math.round(h * 0.855);
    var annotY   = Math.round(h * 0.12);

    // Actual bar-tip pixel positions for 2023 (computed from data, not guessed)
    var count2023high = 0, count2023low = 0;
    pyramidData.forEach(function(d) {
      if (d.year === 2023 && d.risk === "High")           count2023high = d.count;
      if (d.year === 2023 && d.risk === "Low / Moderate") count2023low  = d.count;
    });
    // Right chart (normal scale): pixel x = count / axisDom * halfW
    var dotXRight = Math.round((count2023high / axisDom) * halfW);
    // Left chart (reversed scale): pixel x = (1 - count/axisDom) * halfW
    var dotXLeft  = Math.round((1 - count2023low / axisDom) * halfW);
    // Annotation text anchors (in the whitespace above shorter bars)
    var annotXRight = halfW - 8;   // far-right whitespace
    var annotXLeft  = 8;           // far-left whitespace

    var xAxisTop = {
      orient:      "top",
      format:      "~s",
      tickCount:   4,
      labelFontSize:  9,
      titleFontSize: 10,
      labelColor:  "rgba(246,239,230,0.65)",
      titleColor:  "rgba(246,239,230,0.55)",
      gridColor:   "rgba(255,255,255,0.07)",
      domainColor: "rgba(255,255,255,0.2)"
    };

    return {
      $schema:    "https://vega.github.io/schema/vega-lite/v5.json",
      background: "transparent",
      padding:    0,
      datasets:   { pyramid: pyramidData },
      config: {
        background: "transparent",
        view: { stroke: null, fill: "transparent" },
        font: "system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif",
        axis: {
          labelColor:  "rgba(246,239,230,0.78)",
          titleColor:  "rgba(246,239,230,0.55)",
          gridColor:   "rgba(255,255,255,0.07)",
          domainColor: "rgba(255,255,255,0.18)",
          tickColor:   "rgba(255,255,255,0.18)",
          labelFontSize: 11,
          titleFontSize: 10
        }
      },
      spacing: 2,
      resolve: { scale: { y: "shared" } },
      hconcat: [
        {
          width:  halfW,
          height: h,
          data:   { name: "pyramid" },
          layer: [
            {
              transform: [{ filter: "datum.risk == 'Low / Moderate'" }],
              mark: { type: "bar", cornerRadius: 2, color: "#4f6f88" },
              encoding: {
                y: {
                  field: "year",
                  type:  "ordinal",
                  sort:  "ascending",
                  axis: {
                    orient:          "right",
                    title:           null,
                    labelFontSize:   12,
                    labelFontWeight: "bold",
                    labelColor:      "rgba(246,239,230,0.85)",
                    ticks:           false,
                    domain:          false,
                    labelPadding:    10
                  }
                },
                x: {
                  field: "count",
                  type:  "quantitative",
                  title: "Low / Moderate  (FRP < 50 MW)",
                  scale: { reverse: true, domain: [0, axisDom] },
                  axis:  xAxisTop
                },
                tooltip: [
                  { field: "year",  title: "Year",                      type: "ordinal" },
                  { field: "count", title: "Low / Moderate detections", format: "," }
                ]
              }
            },
            {
              data: { values: [{}] },
              mark: { type: "rule", color: "#4f6f88", strokeWidth: 1.2, strokeDash: [4, 3] },
              encoding: {
                x:  { value: dotXLeft },
                y:  { value: y2023 },
                x2: { value: annotXLeft + 2 },
                y2: { value: annotY + 36 }
              }
            },
            {
              data: { values: [{}] },
              mark: { type: "point", color: "#4f6f88", filled: true, size: 32, strokeWidth: 0 },
              encoding: {
                x: { value: dotXLeft },
                y: { value: y2023 }
              }
            },
            {
              data: { values: [{}] },
              mark: { type: "text", align: "left", baseline: "top", fontSize: 9, color: "rgba(246,239,230,0.72)", lineBreak: "\n", lineHeight: 13 },
              encoding: {
                x:    { value: annotXLeft },
                y:    { value: annotY },
                text: { value: "2023 -- record total\nlow/moderate fires spike\nlate dry-season heat event" }
              }
            }
          ]
        },
        {
          width:  halfW,
          height: h,
          data:   { name: "pyramid" },
          layer: [
            {
              transform: [{ filter: "datum.risk == 'High'" }],
              mark: { type: "bar", cornerRadius: 2, color: "#ef6a1c" },
              encoding: {
                y: {
                  field: "year",
                  type:  "ordinal",
                  sort:  "ascending",
                  axis:  null
                },
                x: {
                  field: "count",
                  type:  "quantitative",
                  title: "High intensity  (FRP >= 50 MW)",
                  scale: { domain: [0, axisDom] },
                  axis:  xAxisTop
                },
                tooltip: [
                  { field: "year",  title: "Year",                 type: "ordinal" },
                  { field: "count", title: "High-risk detections", format: "," }
                ]
              }
            },
            {
              data: { values: [{}] },
              mark: { type: "rule", color: "#ef6a1c", strokeWidth: 1.2, strokeDash: [4, 3] },
              encoding: {
                x:  { value: dotXRight },
                y:  { value: y2023 },
                x2: { value: annotXRight - 2 },
                y2: { value: annotY + 36 }
              }
            },
            {
              data: { values: [{}] },
              mark: { type: "point", color: "#ef6a1c", filled: true, size: 32, strokeWidth: 0 },
              encoding: {
                x: { value: dotXRight },
                y: { value: y2023 }
              }
            },
            {
              data: { values: [{}] },
              mark: { type: "text", align: "right", baseline: "top", fontSize: 9, color: "rgba(246,239,230,0.72)", lineBreak: "\n", lineHeight: 13 },
              encoding: {
                x:    { value: annotXRight },
                y:    { value: annotY },
                text: { value: "2023 -- record peak\nhigh-intensity fires\ndriest dry season on record" }
              }
            }
          ]
        }
      ]
    };
  }

  function teardown() {
    if (embedResult && embedResult.finalize) {
      try { embedResult.finalize(); } catch (e) {}
    }
    embedResult = null;
    if (vizEl) vizEl.innerHTML = "";
  }

  function render() {
    teardown();
    var box = vizBox();
    vegaEmbed(vizEl, buildSpec(box), {
      actions:  false,
      tooltip:  { theme: "dark" },
      renderer: "svg"
    })
      .then(function (result) { embedResult = result; })
      .catch(function (error) {
        vizEl.innerHTML = window.ChartError
          ? window.ChartError("Chart 07", error.message)
          : '<p style="color:#ffd6d6">Chart 7 failed: ' + error.message + "</p>";
      });
  }

  fetch(DATA_URL)
    .then(function (res) {
      if (!res.ok) throw new Error("HTTP " + res.status + " for " + DATA_URL);
      return res.text();
    })
    .then(function (text) {
      prepareData(text);
      requestAnimationFrame(function () {
        requestAnimationFrame(render);
      });
    })
    .catch(function (error) {
      vizEl.innerHTML = window.ChartError
        ? window.ChartError("Chart 07", error.message + " - serve over a local HTTP server.")
        : '<p style="color:#ffd6d6">Chart 7 failed: ' + error.message +
          ". Run a local server (python3 -m http.server 8080).</p>";
    });

  function scheduleRender() {
    clearTimeout(window.__chart7ResizeTimer);
    window.__chart7ResizeTimer = setTimeout(render, 200);
  }

  window.addEventListener("resize", scheduleRender, { passive: true });
  var c7FrameEl = chartContainer.parentElement;
  if (c7FrameEl && typeof ResizeObserver !== "undefined") {
    new ResizeObserver(scheduleRender).observe(c7FrameEl);
  }
})();
