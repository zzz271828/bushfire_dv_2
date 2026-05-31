/**
 * Chart 10 -- Preparedness Distribution: interactive filter + main + thumbnails
 * Four dimensions (Risk Level, Community Type, Fire Management Zone, Regional Council).
 * Filter buttons switch which dimension occupies the main chart; the other three
 * appear as clickable thumbnails below.
 *
 * Preparedness score = FUELREDUC + FIREBREAK + FIREPLAN  (each Yes = 1, range 0-3)
 */
(function () {
  if (window.__chart10Initialized) return;
  window.__chart10Initialized = true;

  var DATA_URL = "datasets/Community_Bushfire_Risk.csv";

  var el = document.getElementById("chart10");
  if (!el || typeof vegaEmbed === "undefined") return;

  var DIMS = [
    { key: "RATING",   label: "By Risk Level",           topN: null },
    { key: "COMMTYPE", label: "By Community Type",        topN: null },
    { key: "FMZONE",   label: "By Fire Mgmt Zone",        topN: null },
    { key: "LGA",      label: "By Regional Council",      topN: 8    }
  ];

  var PREP_LABELS = ["Unprepared (0/3)", "Low (1/3)", "Mostly (2/3)", "Full (3/3)"];
  var PREP_COLORS = ["#8b2500", "#d4701f", "#c49a2b", "#4f6f88"];

  var activeDim    = 0;
  var allData      = {};
  var mainEmbed    = null;
  var thumbEmbeds  = [null, null, null];

  //  HTML skeleton 
  el.innerHTML = [
    '<div class="c10-wrap">',
    '  <div class="c10-filter" id="c10Filter">',
    DIMS.map(function (d, i) {
      return '    <button class="c10-btn' + (i === 0 ? ' c10-active' : '') +
             '" data-dimidx="' + i + '">' + d.label + '</button>';
    }).join(""),
    '  </div>',
    '  <div class="c10-main" id="c10Main">',
    '    <div class="c10-main-viz" id="c10MainViz"></div>',
    '  </div>',
    '  <div class="c10-thumbs" id="c10Thumbs">',
    [0, 1, 2].map(function (t) {
      return '    <div class="c10-thumb" data-thumbidx="' + t + '">' +
             '<div class="c10-thumb-viz" id="c10Thumb' + t + '"></div>' +
             '<span class="c10-thumb-label" id="c10ThumbLabel' + t + '"></span>' +
             '</div>';
    }).join(""),
    '  </div>',
    '</div>'
  ].join("");

  //  CSV parser 
  function parseLine(line) {
    var out = [], cur = "", inQ = false;
    for (var i = 0; i < line.length; i++) {
      var ch = line[i];
      if (ch === '"') {
        if (inQ && line[i + 1] === '"') { cur += '"'; i++; }
        else { inQ = !inQ; }
      } else if (ch === ',' && !inQ) { out.push(cur); cur = ""; }
      else { cur += ch; }
    }
    out.push(cur);
    return out;
  }

  function parseCsv(text) {
    var lines   = text.split(/\r?\n/).filter(function (l) { return l.trim(); });
    var headers = parseLine(lines[0]).map(function (h) { return h.trim(); });
    var rows = [];
    for (var i = 1; i < lines.length; i++) {
      var cols = parseLine(lines[i]);
      var row  = {};
      headers.forEach(function (h, j) { row[h] = (cols[j] || "").trim(); });
      rows.push(row);
    }
    return rows;
  }

  function yesNo(v) { return String(v || "").trim().toLowerCase() === "yes"; }

  function prepScore(row) {
    return (yesNo(row.FUELREDUC) ? 1 : 0)
         + (yesNo(row.FIREBREAK) ? 1 : 0)
         + (yesNo(row.FIREPLAN)  ? 1 : 0);
  }

  //  Aggregation 
  function aggregate(rows, field, topN) {
    var totals = {};
    rows.forEach(function (row) {
      var g = row[field] || "Unknown";
      totals[g] = (totals[g] || 0) + 1;
    });

    var keep = null;
    if (topN && Object.keys(totals).length > topN) {
      var sorted = Object.entries(totals).sort(function (a, b) { return b[1] - a[1]; });
      keep = new Set(sorted.slice(0, topN).map(function (e) { return e[0]; }));
    }

    var counts = {}, finalTotals = {};
    rows.forEach(function (row) {
      var raw = row[field] || "Unknown";
      var g   = (keep && !keep.has(raw)) ? "Other" : raw;
      var pl  = PREP_LABELS[prepScore(row)];
      counts[g + "|" + pl] = (counts[g + "|" + pl] || 0) + 1;
      finalTotals[g]        = (finalTotals[g] || 0) + 1;
    });

    var data = [];
    Object.keys(finalTotals).forEach(function (g) {
      PREP_LABELS.forEach(function (pl, idx) {
        data.push({
          group:     g,
          prepLabel: pl,
          prepOrder: idx,
          count:     counts[g + "|" + pl] || 0,
          total:     finalTotals[g]
        });
      });
    });
    return data;
  }

  //  Vega-Lite specs 
  var BASE_CFG = {
    background: "transparent",
    view: { stroke: "rgba(255,255,255,0.07)", fill: "rgba(255,255,255,0.015)", cornerRadius: 4 },
    font: "Inter, system-ui, -apple-system, sans-serif",
    axis: {
      labelColor:  "rgba(246,239,230,0.78)",
      gridColor:   "rgba(255,255,255,0.07)",
      domainColor: "rgba(255,255,255,0.15)",
      tickColor:   "rgba(255,255,255,0.15)"
    }
  };

  function buildMainSpec(label, data, w, h) {
    return {
      $schema:    "https://vega.github.io/schema/vega-lite/v5.json",
      background: "transparent",
      width:      w,
      height:     h,
      padding:    { left: 4, right: 4, top: 4, bottom: 4 },
      title: {
        text:       label,
        fontSize:   13,
        fontWeight: 600,
        anchor:     "start",
        offset:     6,
        color:      "rgba(246,239,230,0.88)"
      },
      data:   { values: data },
      mark:   { type: "bar", cornerRadius: 3 },
      config: BASE_CFG,
      encoding: {
        y: {
          field: "group",
          type:  "ordinal",
          sort:  { field: "total", op: "max", order: "descending" },
          axis: {
            title:          null,
            labelColor:     "rgba(246,239,230,0.82)",
            labelFontSize:  12,
            labelLimit:     270,
            ticks:          false,
            domain:         false
          }
        },
        x: {
          field: "count",
          type:  "quantitative",
          stack: "normalize",
          axis: {
            format:     "%",
            title:      null,
            tickCount:  4,
            gridColor:  "rgba(255,255,255,0.07)",
            labelColor: "rgba(246,239,230,0.35)",
            labelFontSize: 10,
            domain:     false,
            ticks:      false
          }
        },
        color: {
          field: "prepLabel",
          type:  "ordinal",
          scale: { domain: PREP_LABELS, range: PREP_COLORS },
          legend: {
            title:          "Preparedness tier",
            titleColor:     "rgba(246,239,230,0.7)",
            labelColor:     "rgba(246,239,230,0.7)",
            titleFontSize:  11,
            labelFontSize:  11,
            symbolSize:     130,
            orient:         "right",
            offset:         14
          }
        },
        order:   { field: "prepOrder", type: "quantitative" },
        tooltip: [
          { field: "group",     title: "Group"           },
          { field: "prepLabel", title: "Preparedness"    },
          { field: "count",     title: "Communities",    format: "," },
          { field: "total",     title: "Total in group", format: "," }
        ]
      }
    };
  }

  function buildThumbSpec(data) {
    return {
      $schema:    "https://vega.github.io/schema/vega-lite/v5.json",
      background: "transparent",
      width:      "container",
      height:     { step: 9 },
      padding:    0,
      data:   { values: data },
      mark:   { type: "bar", cornerRadius: 1 },
      config: { background: "transparent", view: { stroke: null, fill: "transparent" } },
      encoding: {
        y: {
          field: "group",
          type:  "ordinal",
          sort:  { field: "total", op: "max", order: "descending" },
          axis:  null
        },
        x: {
          field: "count",
          type:  "quantitative",
          stack: "normalize",
          axis:  null
        },
        color: {
          field: "prepLabel",
          type:  "ordinal",
          scale: { domain: PREP_LABELS, range: PREP_COLORS },
          legend: null
        },
        order: { field: "prepOrder", type: "quantitative" }
      }
    };
  }

  //  Render helpers 
  function finalizeEmbed(embed) {
    if (embed && typeof embed.finalize === "function") {
      try { embed.finalize(); } catch (e) {}
    }
    return null;
  }

  function thumbDimIndices() {
    return DIMS.map(function (_, i) { return i; })
               .filter(function (i) { return i !== activeDim; });
  }

  function renderMain() {
    var dim     = DIMS[activeDim];
    var data    = allData[dim.key];
    var mainEl  = document.getElementById("c10Main");
    var vizEl   = document.getElementById("c10MainViz");
    if (!vizEl) return;

    mainEmbed      = finalizeEmbed(mainEmbed);
    vizEl.innerHTML = "";

    var w = Math.max(200, (mainEl ? mainEl.clientWidth : 840) - 36);
    var h = Math.max(200, (mainEl ? mainEl.clientHeight : 480) - 40);
    vegaEmbed(vizEl, buildMainSpec(dim.label, data, w, h), {
      actions:  false,
      tooltip:  { theme: "dark" },
      renderer: "svg"
    })
      .then(function (r) { mainEmbed = r; })
      .catch(function (err) {
        vizEl.innerHTML = '<p style="color:#ffd6d6;padding:12px;font-family:monospace">Chart 10: ' +
                          err.message + "</p>";
      });
  }

  function renderThumbs() {
    thumbDimIndices().forEach(function (dimIdx, thumbIdx) {
      var dim     = DIMS[dimIdx];
      var data    = allData[dim.key];
      var labelEl = document.getElementById("c10ThumbLabel" + thumbIdx);
      var vizEl   = document.getElementById("c10Thumb" + thumbIdx);
      var thumbEl = document.querySelector('[data-thumbidx="' + thumbIdx + '"]');

      if (labelEl) labelEl.textContent = dim.label;
      if (thumbEl) thumbEl.dataset.targetdim = dimIdx;

      thumbEmbeds[thumbIdx] = finalizeEmbed(thumbEmbeds[thumbIdx]);
      if (!vizEl) return;
      vizEl.innerHTML = "";

      vegaEmbed(vizEl, buildThumbSpec(data), {
        actions:  false,
        renderer: "svg"
      })
        .then(function (r) { thumbEmbeds[thumbIdx] = r; })
        .catch(function () {});
    });
  }

  //  Interactions 
  function setActive(dimIdx) {
    if (dimIdx === activeDim) return;
    activeDim = dimIdx;
    document.querySelectorAll(".c10-btn").forEach(function (btn) {
      btn.classList.toggle("c10-active", +btn.dataset.dimidx === dimIdx);
    });
    renderMain();
    renderThumbs();
  }

  var filterEl = document.getElementById("c10Filter");
  if (filterEl) {
    filterEl.addEventListener("click", function (e) {
      var btn = e.target.closest(".c10-btn");
      if (btn) setActive(+btn.dataset.dimidx);
    });
  }

  var thumbsEl = document.getElementById("c10Thumbs");
  if (thumbsEl) {
    thumbsEl.addEventListener("click", function (e) {
      var thumb = e.target.closest(".c10-thumb");
      if (thumb && thumb.dataset.targetdim !== undefined) {
        setActive(+thumb.dataset.targetdim);
      }
    });
  }

  //  Resize 
  function scheduleRender() {
    clearTimeout(window.__chart10ResizeTimer);
    window.__chart10ResizeTimer = setTimeout(function () {
      renderMain();
      renderThumbs();
    }, 220);
  }
  window.addEventListener("resize", scheduleRender, { passive: true });
  var frameEl = el.parentElement;
  if (frameEl && typeof ResizeObserver !== "undefined") {
    new ResizeObserver(scheduleRender).observe(frameEl);
  }

  //  Bootstrap 
  fetch(DATA_URL)
    .then(function (res) {
      if (!res.ok) throw new Error("HTTP " + res.status);
      return res.text();
    })
    .then(function (text) {
      var rows = parseCsv(text);
      DIMS.forEach(function (dim) {
        allData[dim.key] = aggregate(rows, dim.key, dim.topN);
      });
      requestAnimationFrame(function () {
        renderMain();
        renderThumbs();
      });
    })
    .catch(function (err) {
      el.innerHTML = '<p style="color:#ffd6d6;padding:16px;font-family:monospace">' +
                     'Chart 10 failed: ' + err.message +
                     " &mdash; serve over a local HTTP server.</p>";
    });
})();
