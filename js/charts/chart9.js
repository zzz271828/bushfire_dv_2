/**
 * Chart 9 -- Sankey: Risk Level -> Preparedness Tier -> Funding Status
 * Data: datasets/Community_Bushfire_Risk.csv  (765 NT communities)
 * Library: d3-sankey (loaded from CDN in index.html)
 *
 * Story: All 274 unprepared communities receive no funding.
 * High-risk communities cluster in the Unprepared -> Not Funded flow.
 */
(function () {
  if (window.__chart9Initialized) return;
  window.__chart9Initialized = true;

  var DATA_URL = "datasets/Community_Bushfire_Risk.csv";

  var el = document.getElementById("chart9");
  if (!el) return;

  el.innerHTML = '<div class="chart9-body"><div id="chart9Viz"></div></div>';
  var vizEl = document.getElementById("chart9Viz");

  // -- Color palette (ember theme) ----------------------------------
  var COLORS = {
    // Risk nodes
    "Low Risk":      "#4a7c99",
    "Moderate Risk": "#d97b2e",
    "High Risk":     "#c0392b",
    // Prep nodes
    "Unprepared":           "#8b2500",
    "Partially Prepared":   "#d4701f",
    "Fully Prepared":       "#6a9e5b",
    // Funding nodes
    "Not Funded":         "#6b2737",
    "Community Org":      "#7d5fa3",
    "Local Government":   "#4a7c99",
    "Private Enterprise": "#c49a2b"
  };

  // -- CSV helpers --------------------------------------------------
  function parseLine(line) {
    var out = [], cur = "", inQ = false;
    for (var i = 0; i < line.length; i++) {
      var ch = line[i];
      if (ch === '"') { if (inQ && line[i+1] === '"') { cur += '"'; i++; } else { inQ = !inQ; } }
      else if (ch === ',' && !inQ) { out.push(cur); cur = ""; }
      else { cur += ch; }
    }
    out.push(cur);
    return out;
  }

  function parseCsv(text) {
    var lines = text.split(/\r?\n/).filter(function (l) { return l.trim(); });
    var headers = parseLine(lines[0]).map(function (h) { return h.trim(); });
    var rows = [];
    for (var i = 1; i < lines.length; i++) {
      var cols = parseLine(lines[i]);
      var row = {};
      for (var j = 0; j < headers.length; j++) row[headers[j]] = cols[j] || "";
      rows.push(row);
    }
    return rows;
  }

  function yesNo(v) { return String(v || "").trim().toLowerCase() === "yes"; }

  function prepTier(row) {
    var s = (yesNo(row.FUELREDUC) ? 1 : 0) + (yesNo(row.FIREBREAK) ? 1 : 0) + (yesNo(row.FIREPLAN) ? 1 : 0);
    if (s === 0) return "Unprepared";
    if (s <= 2)  return "Partially Prepared";
    return "Fully Prepared";
  }

  function fundStatus(row) {
    var t = String(row.MUNSTYPE || "").trim();
    if (t.indexOf("Not Funded") !== -1) return "Not Funded";
    if (t.indexOf("Aboriginal") !== -1) return "Community Org";
    if (t.indexOf("Local Government") !== -1) return "Local Government";
    return "Private Enterprise";
  }

  // -- Aggregate flows ----------------------------------------------
  function aggregate(rows) {
    var rp = {}, pf = {};
    rows.forEach(function (row) {
      var risk = String(row.RATING || "").trim() + " Risk";
      var prep = prepTier(row);
      var fund = fundStatus(row);
      var kRP = risk + "|" + prep;
      var kPF = prep + "|" + fund;
      rp[kRP] = (rp[kRP] || 0) + 1;
      pf[kPF] = (pf[kPF] || 0) + 1;
    });
    return { rp: rp, pf: pf };
  }

  // -- Build Sankey graph object ------------------------------------
  function buildGraph(agg) {
    var nodeNames = [
      // Risk column
      "Low Risk", "Moderate Risk", "High Risk",
      // Prep column
      "Unprepared", "Partially Prepared", "Fully Prepared",
      // Fund column
      "Not Funded", "Community Org", "Local Government", "Private Enterprise"
    ];
    var nodeIndex = {};
    nodeNames.forEach(function (n, i) { nodeIndex[n] = i; });

    var nodes = nodeNames.map(function (n) { return { name: n }; });
    var links = [];

    Object.keys(agg.rp).forEach(function (k) {
      var parts = k.split("|");
      links.push({ source: nodeIndex[parts[0]], target: nodeIndex[parts[1]], value: agg.rp[k] });
    });
    Object.keys(agg.pf).forEach(function (k) {
      var parts = k.split("|");
      links.push({ source: nodeIndex[parts[0]], target: nodeIndex[parts[1]], value: agg.pf[k] });
    });

    return { nodes: nodes, links: links };
  }

  // -- Render --------------------------------------------------------
  function render(graph) {
    var W = Math.max(560, vizEl.clientWidth  || 900);
    var H = Math.max(380, vizEl.clientHeight || 520);
    var margin = { top: 24, right: 180, bottom: 24, left: 180 };
    var innerW = W - margin.left - margin.right;
    var innerH = H - margin.top  - margin.bottom;

    vizEl.innerHTML = "";

    var svg = d3.select(vizEl).append("svg")
      .attr("width", W).attr("height", H)
      .style("background", "transparent")
      .style("overflow", "visible");

    var g = svg.append("g")
      .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

    // Tooltip
    var tooltip = d3.select(vizEl).append("div")
      .style("position", "absolute")
      .style("pointer-events", "none")
      .style("display", "none")
      .style("background", "rgba(12,10,12,0.95)")
      .style("border", "1px solid #e85d2c")
      .style("border-radius", "4px")
      .style("padding", "7px 10px")
      .style("font-family", "'JetBrains Mono', monospace")
      .style("font-size", "11px")
      .style("color", "#f6efe6")
      .style("z-index", "10")
      .style("line-height", "1.55");

    // Build sankey layout
    var sankeyLayout = d3.sankey()
      .nodeWidth(18)
      .nodePadding(14)
      .extent([[0, 0], [innerW, innerH]])
      .nodeAlign(d3.sankeyJustify);

    var sankeyData = sankeyLayout({
      nodes: graph.nodes.map(function (d) { return Object.assign({}, d); }),
      links: graph.links.map(function (d) { return Object.assign({}, d); })
    });

    // Column labels
    var colLabels = [
      { x: sankeyData.nodes.find(function(n){ return n.name === "Low Risk"; }).x0 + 9, label: "Risk Level" },
      { x: sankeyData.nodes.find(function(n){ return n.name === "Unprepared"; }).x0 + 9, label: "Preparedness" },
      { x: sankeyData.nodes.find(function(n){ return n.name === "Not Funded"; }).x0 + 9, label: "Funding Status" }
    ];
    colLabels.forEach(function (cl) {
      g.append("text")
        .attr("x", cl.x).attr("y", -10)
        .attr("text-anchor", "middle")
        .attr("font-family", "'JetBrains Mono', monospace")
        .attr("font-size", "10px")
        .attr("letter-spacing", "0.18em")
        .attr("text-transform", "uppercase")
        .attr("fill", "rgba(246,239,230,0.45)")
        .text(cl.label.toUpperCase());
    });

    // Links
    g.append("g").attr("fill", "none")
      .selectAll("path")
      .data(sankeyData.links)
      .join("path")
        .attr("d", d3.sankeyLinkHorizontal())
        .attr("stroke", function (d) { return COLORS[d.source.name] || "#e85d2c"; })
        .attr("stroke-width", function (d) { return Math.max(1.5, d.width); })
        .attr("stroke-opacity", 0.28)
        .style("cursor", "default")
        .on("mouseover", function (event, d) {
          d3.select(this).attr("stroke-opacity", 0.6);
          var pct = ((d.value / 765) * 100).toFixed(1);
          tooltip.style("display", "block")
            .html("<strong style='color:#e8a87c'>" + d.source.name + " &rarr; " + d.target.name + "</strong><br/>" +
                  d.value + " communities (" + pct + "%)");
        })
        .on("mousemove", function (event) {
          var rect = vizEl.getBoundingClientRect();
          tooltip
            .style("left", (event.clientX - rect.left + 12) + "px")
            .style("top",  (event.clientY - rect.top  - 28) + "px");
        })
        .on("mouseleave", function () {
          d3.select(this).attr("stroke-opacity", 0.28);
          tooltip.style("display", "none");
        });

    // Nodes
    var nodeG = g.append("g")
      .selectAll("g")
      .data(sankeyData.nodes)
      .join("g");

    nodeG.append("rect")
      .attr("x", function (d) { return d.x0; })
      .attr("y", function (d) { return d.y0; })
      .attr("width",  function (d) { return d.x1 - d.x0; })
      .attr("height", function (d) { return Math.max(2, d.y1 - d.y0); })
      .attr("fill",   function (d) { return COLORS[d.name] || "#888"; })
      .attr("rx", 2)
      .style("cursor", "default")
      .on("mouseover", function (event, d) {
        var pct = ((d.value / 765) * 100).toFixed(1);
        tooltip.style("display", "block")
          .html("<strong style='color:#e8a87c'>" + d.name + "</strong><br/>" +
                d.value + " communities (" + pct + "%)");
      })
      .on("mousemove", function (event) {
        var rect = vizEl.getBoundingClientRect();
        tooltip
          .style("left", (event.clientX - rect.left + 14) + "px")
          .style("top",  (event.clientY - rect.top  - 28) + "px");
      })
      .on("mouseleave", function () { tooltip.style("display", "none"); });

    // Node labels -- left-aligned for left column, right-aligned for right, centered for middle
    nodeG.append("text")
      .attr("x", function (d) {
        if (d.x0 < innerW * 0.35) return d.x0 - 8;
        if (d.x0 > innerW * 0.65) return d.x1 + 8;
        return (d.x0 + d.x1) / 2;
      })
      .attr("y", function (d) { return (d.y0 + d.y1) / 2; })
      .attr("dy", "0.35em")
      .attr("text-anchor", function (d) {
        if (d.x0 < innerW * 0.35) return "end";
        if (d.x0 > innerW * 0.65) return "start";
        return "middle";
      })
      .attr("font-family", "'Inter', system-ui, sans-serif")
      .attr("font-size", "12px")
      .attr("font-weight", "600")
      .attr("fill", function (d) { return COLORS[d.name] || "#f6efe6"; })
      .text(function (d) { return d.name; });

    // Value badges on each node (count)
    nodeG.append("text")
      .attr("x", function (d) {
        if (d.x0 < innerW * 0.35) return d.x0 - 8;
        if (d.x0 > innerW * 0.65) return d.x1 + 8;
        return (d.x0 + d.x1) / 2;
      })
      .attr("y", function (d) { return (d.y0 + d.y1) / 2 + 15; })
      .attr("dy", "0.35em")
      .attr("text-anchor", function (d) {
        if (d.x0 < innerW * 0.35) return "end";
        if (d.x0 > innerW * 0.65) return "start";
        return "middle";
      })
      .attr("font-family", "'JetBrains Mono', monospace")
      .attr("font-size", "10px")
      .attr("fill", "rgba(246,239,230,0.5)")
      .text(function (d) { return "n=" + d.value; });
  }

  // -- Data load + init --------------------------------------------
  var cachedGraph = null;

  function waitForSankey(cb) {
    if (typeof d3 !== "undefined" && typeof d3.sankey === "function") { cb(); return; }
    var t = 0;
    var iv = setInterval(function () {
      t += 50;
      if (typeof d3 !== "undefined" && typeof d3.sankey === "function") { clearInterval(iv); cb(); }
      else if (t > 6000) { clearInterval(iv); vizEl.innerHTML = '<p style="color:#ffd6d6">d3-sankey not loaded.</p>'; }
    }, 50);
  }

  fetch(DATA_URL)
    .then(function (res) {
      if (!res.ok) throw new Error("HTTP " + res.status);
      return res.text();
    })
    .then(function (text) {
      cachedGraph = buildGraph(aggregate(parseCsv(text)));
      waitForSankey(function () {
        requestAnimationFrame(function () { render(cachedGraph); });
      });
    })
    .catch(function (err) {
      vizEl.innerHTML = '<p style="color:#ffd6d6;padding:16px;font-family:monospace">Chart 9 failed: ' + err.message + '</p>';
    });

  // Re-render on resize (uses cached graph, no re-fetch)
  var resizeTimer;
  window.addEventListener("resize", function () {
    if (!cachedGraph) return;
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () {
      render(cachedGraph);
    }, 250);
  }, { passive: true });
})();
