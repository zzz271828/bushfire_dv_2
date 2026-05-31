/**
 * Chart 8 - Ridgeline density plot: population distribution by bushfire risk.
 * Pure D3.js. KDE in log10 space so the heavy skew is visible.
 */
(function () {
  "use strict";

//nstants -

  /** Top-to-bottom display order (High is most important - render on top). */
  const RISK_ORDER = ["High", "Moderate", "Low"];

  const COLORS = {
    High:     { stroke: "#d96060", fill: "#a02f2f" },
    Moderate: { stroke: "#e8a048", fill: "#b07030" },
    Low:      { stroke: "#5aaecc", fill: "#2e7a99" }
  };

//

  function gaussianKDE(bw, data) {
    const c = 1 / (bw * Math.sqrt(2 * Math.PI));
    return function (x) {
      let sum = 0;
      for (let i = 0; i < data.length; i++) {
        const u = (x - data[i]) / bw;
        sum += Math.exp(-0.5 * u * u);
      }
      return c * sum / data.length;
    };
  }

  function silverman(vals) {
    const n = vals.length;
    if (n < 2) return 0.3;
    const sorted = vals.slice().sort((a, b) => a - b);
    const std = d3.deviation(vals) || 0.01;
    const q1  = d3.quantile(sorted, 0.25);
    const q3  = d3.quantile(sorted, 0.75);
    const iqr = (q3 - q1) / 1.34;
    const s   = Math.min(std, iqr > 0 ? iqr : std);
    return 1.06 * s * Math.pow(n, -0.2);
  }

//nistic jitter (no random drift on resize) -

  function nameHash(str) {
    let h = 0x811c9dc5;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = (h * 0x01000193) >>> 0;
    }
    return h;
  }

//n draw function -

  function draw(allRows, container) {
    const rows = allRows.filter(
      d => Number.isFinite(d.POPULATION) && d.POPULATION > 0 && RISK_ORDER.includes(d.RATING)
    );
    if (!rows.length) return;

    const maxPop     = d3.max(rows, d => d.POPULATION);
    const totalW     = Math.max(420, container.clientWidth  || 700);
    const contH      = Math.max(380, container.clientHeight || 520);
    const margin     = { top: 28, right: 52, bottom: 58, left: 74 };
    // Back-calculate ridgeSp and curveH so all three ridges fill the container height
    const available  = contH - margin.top - margin.bottom - 56;
    const curveH     = Math.max(90,  Math.round(available * 0.40));
    const ridgeSp    = Math.max(70,  Math.round((available - curveH) / (RISK_ORDER.length - 1)));
    const innerW     = totalW - margin.left - margin.right;
    const totalH     = margin.top + curveH + ridgeSp * (RISK_ORDER.length - 1) + 56 + margin.bottom;

    container.innerHTML = "";
    container.style.position = "relative";

    const svg = d3.select(container)
      .append("svg")
      .attr("width",  "100%")
      .attr("height", "100%")
      .attr("viewBox", `0 0 ${totalW} ${totalH}`)
      .attr("preserveAspectRatio", "xMidYMid meet")
      .style("display", "block")
      .style("overflow", "visible");

//
    const defs = svg.append("defs");

    RISK_ORDER.forEach(r => {
      const grad = defs.append("linearGradient")
        .attr("id", `c8g-${r}`)
        .attr("gradientUnits", "userSpaceOnUse")
        .attr("x1", 0).attr("y1", -curveH)
        .attr("x2", 0).attr("y2", 0);
      grad.append("stop").attr("offset", "0%")
        .attr("stop-color", COLORS[r].fill).attr("stop-opacity", 0.52);
      grad.append("stop").attr("offset", "78%")
        .attr("stop-color", COLORS[r].fill).attr("stop-opacity", 0.10);
      grad.append("stop").attr("offset", "100%")
        .attr("stop-color", COLORS[r].fill).attr("stop-opacity", 0.02);
    });

    // clip so curves don't bleed outside inner area
    defs.append("clipPath").attr("id", "c8clip")
      .append("rect")
      .attr("x", 0).attr("y", -curveH - 4)
      .attr("width", innerW).attr("height", totalH);

    // root group: translate so baseline of first ridge is at y=curveH from top
    const rootY = margin.top + curveH;
    const root  = svg.append("g")
      .attr("transform", `translate(${margin.left},${rootY})`);

//
    const xScale = d3.scaleLog()
      .domain([1, maxPop * 1.15])
      .range([0, innerW])
      .clamp(true);

    const ridgeY = {};
    RISK_ORDER.forEach((r, i) => { ridgeY[r] = i * ridgeSp; });

//
    const logMax    = Math.log10(maxPop);
    const nSamples  = 320;
    const logTicks  = d3.range(0, logMax + 0.02, logMax / nSamples);

    const groups = {};
    RISK_ORDER.forEach(r => {
      const data      = rows.filter(d => d.RATING === r);
      const logVals   = data.map(d => Math.log10(Math.max(1, d.POPULATION)));
      const bw        = Math.max(0.08, silverman(logVals));
      const kernelFn  = gaussianKDE(bw, logVals);
      // densityPts: [[popLinear, density], ...]
      const pts = logTicks.map(lx => [Math.pow(10, lx), kernelFn(lx)]);
      groups[r] = { data, pts };
    });

    const maxDens = d3.max(RISK_ORDER.flatMap(r => groups[r].pts.map(p => p[1])));
    const densY   = d3.scaleLinear().domain([0, maxDens]).range([0, -curveH]);

//
    [1, 10, 100, 1000, 10000, 100000]
      .filter(v => v <= maxPop * 1.15)
      .forEach(v => {
        root.append("line")
          .attr("x1", xScale(v)).attr("x2", xScale(v))
          .attr("y1", -curveH).attr("y2", ridgeY["Low"] + 16)
          .attr("stroke", "rgba(255,255,255,0.05)")
          .attr("stroke-width", 1)
          .attr("stroke-dasharray", "3,6");
      });

//
    const axisG = root.append("g")
      .attr("transform", `translate(0,${ridgeY["Low"] + 22})`);

    axisG.call(
      d3.axisBottom(xScale)
        .tickValues([1, 10, 100, 1000, 10000])
        .tickFormat(d => d >= 1000 ? d3.format(".0s")(d) : String(d))
        .tickSize(-ridgeY["Low"] - 38)
    )
    .call(ax => {
      ax.select(".domain").attr("stroke", "rgba(255,255,255,0.20)");
      ax.selectAll(".tick line")
        .attr("stroke", "rgba(255,255,255,0.07)")
        .attr("stroke-dasharray", "2,5");
      ax.selectAll(".tick text")
        .attr("fill", "#9ca8b5")
        .attr("font-size", 10.5)
        .attr("font-family", "JetBrains Mono, monospace")
        .attr("dy", "1.1em");
    });

    axisG.append("text")
      .attr("x", innerW / 2)
      .attr("y", 40)
      .attr("text-anchor", "middle")
      .attr("fill", "rgba(246,239,230,0.38)")
      .attr("font-size", 10.5)
      .attr("font-family", "Inter, sans-serif")
      .text("Community population (log scale)");

//
    const tip = d3.select(container).append("div")
      .style("position", "absolute")
      .style("pointer-events", "none")
      .style("opacity", "0")
      .style("background", "rgba(8,6,13,0.96)")
      .style("border", "1px solid rgba(246,239,230,0.14)")
      .style("border-radius", "4px")
      .style("padding", "10px 14px")
      .style("font-family", "Inter, system-ui, sans-serif")
      .style("font-size", "12px")
      .style("color", "#f6efe6")
      .style("line-height", "1.65")
      .style("z-index", "200")
      .style("max-width", "236px")
      .style("transition", "opacity 60ms ease");

    function moveTip(ev) {
      const rect = container.getBoundingClientRect();
      const tx   = ev.clientX - rect.left + 14;
      const ty   = ev.clientY - rect.top  - 14;
      tip
        .style("left",  Math.min(tx, totalW - 252) + "px")
        .style("top",   Math.max(4, ty)  + "px");
    }

//nt: Low first, High last) -
    [...RISK_ORDER].reverse().forEach(rating => {
      const yBase = ridgeY[rating];
      const col   = COLORS[rating];
      const { data, pts } = groups[rating];

      const rg = root.append("g")
        .attr("class", `c8ridge c8ridge-${rating}`)
        .attr("transform", `translate(0,${yBase})`)
        .attr("clip-path", "url(#c8clip)");

      const areaGen = d3.area()
        .x(p => xScale(p[0]))
        .y0(0)
        .y1(p => densY(p[1]))
        .curve(d3.curveBasis);

      const lineGen = d3.line()
        .x(p => xScale(p[0]))
        .y(p => densY(p[1]))
        .curve(d3.curveBasis);

      // fill
      const fillP = rg.append("path")
        .datum(pts)
        .attr("fill", `url(#c8g-${rating})`)
        .attr("d", areaGen)
        .attr("opacity", 0);

      // stroke
      const strokeP = rg.append("path")
        .datum(pts)
        .attr("fill", "none")
        .attr("stroke", col.stroke)
        .attr("stroke-width", 1.6)
        .attr("d", lineGen);

      const pathLen = strokeP.node().getTotalLength();
      strokeP
        .attr("stroke-dasharray", pathLen + " " + pathLen)
        .attr("stroke-dashoffset", pathLen);

      // animate (staggered by risk order index)
      const delay = RISK_ORDER.indexOf(rating) * 140;

      fillP.transition().duration(950).delay(delay).attr("opacity", 1);
      strokeP.transition().duration(1050).delay(delay).attr("stroke-dashoffset", 0);

//nd & median -
      const sorted = data.map(d => d.POPULATION).sort(d3.ascending);
      const q1     = d3.quantile(sorted, 0.25);
      const q2     = d3.quantile(sorted, 0.5);
      const q3     = d3.quantile(sorted, 0.75);

      if (q1 && q3 && xScale(q3) > xScale(q1)) {
        rg.append("rect")
          .attr("x",      xScale(Math.max(1, q1)))
          .attr("width",  xScale(q3) - xScale(Math.max(1, q1)))
          .attr("y",      -10)
          .attr("height", 10)
          .attr("fill",   col.stroke)
          .attr("opacity", 0.18)
          .attr("rx",     1.5);
      }

      if (q2) {
        rg.append("line")
          .attr("x1", xScale(q2)).attr("x2", xScale(q2))
          .attr("y1", -22).attr("y2", 6)
          .attr("stroke", "#f2d98a")
          .attr("stroke-width", 1.4)
          .attr("opacity", 0.88);

        rg.append("circle")
          .attr("cx", xScale(q2)).attr("cy", 0)
          .attr("r", 2.8)
          .attr("fill", "#f2d98a")
          .attr("stroke", "rgba(8,6,13,0.75)")
          .attr("stroke-width", 1);
      }

//
      rg.append("text")
        .attr("x", -10).attr("y", -24)
        .attr("text-anchor", "end")
        .attr("fill", col.stroke)
        .attr("font-size", 11)
        .attr("font-weight", 600)
        .attr("font-family", "Inter, sans-serif")
        .text(rating);

      rg.append("text")
        .attr("x", -10).attr("y", -11)
        .attr("text-anchor", "end")
        .attr("fill", "rgba(246,239,230,0.30)")
        .attr("font-size", 9)
        .attr("font-family", "Inter, sans-serif")
        .text("n=" + data.length);

//nity dots -
      rg.selectAll(".c8dot")
        .data(data)
        .enter().append("circle")
        .attr("class", "c8dot")
        .attr("cx", d => xScale(Math.max(1, d.POPULATION)))
        .attr("cy", d => {
          const h = nameHash(d.COMMUNITY);
          return ((h & 0x1f) - 15.5) * 0.72;  // range ~+-11px
        })
        .attr("r", 2.4)
        .attr("fill", col.stroke)
        .attr("opacity", 0)
        .attr("stroke", "none")
        .style("cursor", "crosshair")
        .on("mouseenter", function (ev, d) {
          d3.select(this).attr("r", 5).attr("opacity", 1)
            .attr("stroke", "rgba(255,255,255,0.6)").attr("stroke-width", 0.8);
          tip.style("opacity", "1").html(
            `<div style="font-weight:600;margin-bottom:3px">${d.COMMUNITY}</div>` +
            `<div style="color:rgba(246,239,230,0.50);font-size:10.5px;margin-bottom:6px">${d.LGA} | ${d.COMMTYPE}</div>` +
            `<div>Population&nbsp;<strong>${d.POPULATION.toLocaleString()}</strong></div>` +
            `<div>Risk&nbsp;<strong style="color:${col.stroke}">${d.RATING}</strong></div>` +
            `<div>Preparedness&nbsp;<strong>${d.preparednessScore}/3</strong></div>` +
            `<div style="margin-top:6px;font-size:10px;color:rgba(246,239,230,0.42)">` +
            `Fuel: ${d.FUELREDUC} | Firebreak: ${d.FIREBREAK} | Plan: ${d.FIREPLAN}</div>`
          );
          moveTip(ev);
        })
        .on("mousemove", moveTip)
        .on("mouseleave", function () {
          d3.select(this).attr("r", 2.4).attr("opacity", 0.38).attr("stroke", "none");
          tip.style("opacity", "0");
        })
        .transition().duration(500).delay((_, i) => 700 + i * 4)
        .attr("opacity", 0.38);
    });

    // --- LEGEND (left margin, SVG x=2, outside the clip area so no line overlap) ---
    const legG = svg.append("g")
      .attr("class", "c8-legend")
      .attr("transform", `translate(2,${margin.top + 16})`);

    const legData = [
      { label: "High",     color: COLORS.High.stroke,     isRect: false },
      { label: "Moderate", color: COLORS.Moderate.stroke,  isRect: false },
      { label: "Low",      color: COLORS.Low.stroke,       isRect: false },
      { label: "Median",   color: "#f2d98a",               isRect: false },
      { label: "IQR",      color: "#9ca8b5",               isRect: true  }
    ];

    legData.forEach(function(item, i) {
      const ly = i * 16;
      if (item.isRect) {
        legG.append("rect")
          .attr("x", 0).attr("width", 14).attr("y", ly - 5).attr("height", 8)
          .attr("fill", item.color).attr("opacity", 0.30).attr("rx", 1.5);
      } else {
        legG.append("line")
          .attr("x1", 0).attr("x2", 14).attr("y1", ly).attr("y2", ly)
          .attr("stroke", item.color).attr("stroke-width", 2);
      }
      legG.append("text")
        .attr("x", 18).attr("y", ly + 4)
        .attr("fill", item.isRect ? "rgba(246,239,230,0.42)" : item.color)
        .attr("font-size", 9)
        .attr("font-family", "Inter, sans-serif")
        .text(item.label);
    });

    // --- ANNOTATIONS ---
    const annLayer = root.append("g").attr("class", "c8-annotations");

    // 1. High-risk tiny communities
    const highData = groups["High"].data;
    const under100 = highData.filter(d => d.POPULATION < 100).length;
    const pctSmall = Math.round((under100 / highData.length) * 100);

    if (pctSmall >= 30) {
      const ax = xScale(40);
      const ay = ridgeY["High"] - curveH * 0.68;
      const tx = ax + 20;
      const ty = ridgeY["High"] - curveH * 0.28;

      annLayer.append("line")
        .attr("x1", ax).attr("x2", tx - 4)
        .attr("y1", ay).attr("y2", ty)
        .attr("stroke", "rgba(217,96,96,0.65)")
        .attr("stroke-width", 1.2)
        .attr("stroke-dasharray", "4,3");

      annLayer.append("circle")
        .attr("cx", ax).attr("cy", ay)
        .attr("r", 3.5)
        .attr("fill", "#d96060");

      annLayer.append("text")
        .attr("x", tx).attr("y", ty)
        .attr("fill", "rgba(217,96,96,0.90)")
        .attr("font-size", 11)
        .attr("font-family", "Inter, sans-serif")
        .attr("font-weight", 600)
        .text(`${pctSmall}% of high-risk communities`);

      annLayer.append("text")
        .attr("x", tx).attr("y", ty + 14)
        .attr("fill", "rgba(217,96,96,0.80)")
        .attr("font-size", 11)
        .attr("font-family", "Inter, sans-serif")
        .text("have fewer than 100 residents");
    }

    // 2. Moderate: widest spread
    const modPops = groups["Moderate"].data.map(d => d.POPULATION).sort(d3.ascending);
    const mq1 = d3.quantile(modPops, 0.25);
    const mq3 = d3.quantile(modPops, 0.75);
    if (mq1 && mq3 && mq3 / mq1 > 15) {
      const mx1 = xScale(Math.max(1, mq1));
      const mx3 = xScale(mq3);
      const my  = ridgeY["Moderate"] - 32;

      annLayer.append("line")
        .attr("x1", mx1 + 4).attr("x2", mx3 - 4)
        .attr("y1", my).attr("y2", my)
        .attr("stroke", "rgba(232,160,72,0.55)")
        .attr("stroke-width", 1.1)
        .attr("stroke-dasharray", "3,3");

      annLayer.append("text")
        .attr("x", (mx1 + mx3) / 2).attr("y", my - 7)
        .attr("text-anchor", "middle")
        .attr("fill", "rgba(232,160,72,0.80)")
        .attr("font-size", 10.5)
        .attr("font-family", "Inter, sans-serif")
        .text("Widest spread -- all settlement types");
    }

    // 3. Right tail: mark the 1k threshold -- few communities exceed it
    const over1k = rows.filter(d => d.POPULATION >= 1000).length;
    if (over1k > 0 && xScale(1000) < innerW - 60) {
      const lx = xScale(1000);
      annLayer.append("line")
        .attr("x1", lx).attr("x2", lx)
        .attr("y1", -curveH + 4).attr("y2", ridgeY["Low"] + 10)
        .attr("stroke", "rgba(246,239,230,0.14)")
        .attr("stroke-width", 1)
        .attr("stroke-dasharray", "2,5");

      annLayer.append("text")
        .attr("x", lx - 8).attr("y", -curveH + 16)
        .attr("text-anchor", "end")
        .attr("fill", "rgba(246,239,230,0.55)")
        .attr("font-size", 10.5)
        .attr("font-family", "Inter, sans-serif")
        .text("Only " + over1k + " communities exceed 1,000");
    }
  }

//

  const container = document.getElementById("chart8");
  if (!container || !window.CommunityData) return;

  container.style.position = "relative";
  container.innerHTML =
    '<p style="padding:18px 0;color:rgba(246,239,230,0.30);font-size:12px;font-family:Inter,sans-serif">Loading...</p>';

  window.CommunityData.load()
    .then(function (d) {
      function tryDraw() {
        if (typeof d3 === "undefined") { setTimeout(tryDraw, 80); return; }
        draw(d.rows, container);
      }
      tryDraw();

      let rTimer;
      window.addEventListener("resize", function () {
        clearTimeout(rTimer);
        rTimer = setTimeout(function () { draw(d.rows, container); }, 220);
      }, { passive: true });
    })
    .catch(function (err) {
      container.innerHTML =
        '<p style="color:#d95f5f;padding:18px 0;font-size:12px;font-family:Inter,sans-serif">Chart 8 failed: ' +
        err.message + "</p>";
    });
})();
