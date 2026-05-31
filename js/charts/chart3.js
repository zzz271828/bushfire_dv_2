/**
 * Chart 3 — NT monthly hotspot heatmap (month × year).
 * Data: datasets/northern_territory_monthly.csv
 */
(function () {
  const chartContainer = document.getElementById("chart3");
  if (!chartContainer || typeof vegaEmbed === "undefined") return;

  chartContainer.innerHTML = [
    '<h2 class="chart1-title">NT Bushfire Hotspots by Month and Year</h2>',
    '<div class="chart3-body">',
    '  <div id="chart3Viz"></div>',
    "</div>"
  ].join("");

  const vizEl = document.getElementById("chart3Viz");
  const bodyEl = chartContainer.querySelector(".chart3-body");

  function chartWidth() {
    const w = (bodyEl && bodyEl.clientWidth) || chartContainer.clientWidth || 600;
    return Math.max(280, Math.floor(w));
  }

  function buildSpec(width) {
    const height = Math.max(300, Math.round(width * 0.52));
    const bandScale = { paddingInner: 0, paddingOuter: 0 };

    const monthEncoding = {
      field: "monthName",
      type: "ordinal",
      title: "Month",
      sort: { field: "monthNum", order: "ascending" },
      scale: bandScale,
      axis: {
        labelAngle: 0,
        labelAlign: "center",
        labelBaseline: "top",
        labelPadding: 4,
        labelColor: "#d4d7dd",
        titleColor: "#eef1f5"
      }
    };

    const yearEncoding = {
      field: "year",
      type: "ordinal",
      title: "Year",
      sort: "ascending",
      scale: bandScale,
      axis: { labelColor: "#d4d7dd", titleColor: "#eef1f5" }
    };

    return {
      $schema: "https://vega.github.io/schema/vega-lite/v5.json",
      width: width,
      height: height,
      background: "transparent",
      data: { url: "datasets/northern_territory_monthly.csv" },
      transform: [
        {
          calculate: "utcmonth(datum.date)",
          as: "monthIndex"
        },
        {
          calculate: "datum.monthIndex + 1",
          as: "monthNum"
        },
        {
          calculate:
            "['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][datum.monthIndex]",
          as: "monthName"
        },
        { filter: "datum.monthNum >= 1 && datum.monthNum <= 12" }
      ],
      layer: [
        {
          mark: { type: "rect", cornerRadius: 1, tooltip: true },
          encoding: {
            x: monthEncoding,
            y: yearEncoding,
            width: { band: 1 },
            height: { band: 1 },
            color: {
              field: "count",
              type: "quantitative",
              title: "Hotspots",
              scale: {
                type: "linear",
                domain: [0, 60000],
                range: [
                  "#140908",
                  "#4F2114",
                  "#7a3018",
                  "#b84810",
                  "#e89008",
                  "#ffd400",
                  "#FFF894"
                ]
              },
              legend: {
                orient: "right",
                titleColor: "#ffffff",
                labelColor: "#ffffff",
                gradientLength: Math.min(160, height - 80),
                format: ",d",
                labelFontSize: 11,
                titleFontSize: 12,
                titleFontWeight: "bold"
              }
            },
            tooltip: [
              { field: "year", type: "ordinal", title: "Year" },
              { field: "monthName", type: "nominal", title: "Month" },
              {
                field: "count",
                type: "quantitative",
                title: "Hotspots",
                format: ","
              }
            ]
          }
        },
        {
          transform: [{ filter: "datum.count >= 3500" }],
          mark: {
            type: "text",
            baseline: "middle",
            fontSize: 9,
            fontWeight: 500,
            tooltip: null
          },
          encoding: {
            x: {
              field: "monthName",
              type: "ordinal",
              sort: { field: "monthNum", order: "ascending" },
              scale: bandScale
            },
            y: {
              field: "year",
              type: "ordinal",
              sort: "ascending",
              scale: bandScale
            },
            text: {
              field: "count",
              type: "quantitative",
              format: ",d"
            },
            fill: {
              condition: [
                {
                  test: "datum.count > 14000",
                  value: "#111318"
                },
                {
                  test: "datum.count > 0",
                  value: "rgba(245, 246, 247, 0.55)"
                }
              ],
              value: "#f5f6f7"
            }
          }
        }
      ],
      resolve: { scale: { x: "shared", y: "shared" } },
      config: {
        background: "transparent",
        view: { stroke: null, fill: "transparent" },
        axis: { grid: false, domainColor: "rgba(255,255,255,0.2)" },
        legend: {
          titleColor: "#ffffff",
          labelColor: "#ffffff"
        }
      }
    };
  }

  let lastEmbed = null;

  function render() {
    const w = chartWidth();
    if (lastEmbed && lastEmbed.finalize) {
      try {
        lastEmbed.finalize();
      } catch (e) {
        /* ignore */
      }
      lastEmbed = null;
    }

    vegaEmbed(vizEl, buildSpec(w), { actions: false })
      .then(function (result) {
        lastEmbed = result;
        vizEl.querySelectorAll(
          ".role-legend text, .role-legend-title, g.legend text, .legend-label text"
        ).forEach(function (node) {
          node.setAttribute("fill", "#ffffff");
        });
      })
      .catch(function (error) {
        vizEl.innerHTML =
          '<p style="color:#ffd6d6">Chart 3 failed: ' + error.message + "</p>";
      });
  }

  fetch("datasets/northern_territory_monthly.csv")
    .then(function (r) {
      if (!r.ok) throw new Error("HTTP " + r.status);
      return r.text();
    })
    .then(function () {
      render();
      window.addEventListener("resize", render, { passive: true });
    })
    .catch(function (error) {
      vizEl.innerHTML =
        '<p style="color:#ffd6d6">Chart 3 failed: ' +
        error.message +
        ". Run a local server (e.g. python3 -m http.server 8080).</p>";
    });
})();
