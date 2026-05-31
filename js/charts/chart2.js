/**
 * Chart 2 — Northern Territory hotspots (overview + detail, Week 10 studio).
 * Monthly counts from datasets/northern_territory_monthly.csv
 * (aggregated from datasets/northern_territory_hotspots.csv).
 */
(function () {
  const chartContainer = document.getElementById("chart2");
  if (!chartContainer || typeof vegaEmbed === "undefined") return;

  chartContainer.innerHTML = [
    '<h2 class="chart1-title">Northern Territory Bushfire Hotspots Over Time</h2>',
    '<div class="chart2-body">',
    '  <div id="chart2Viz"></div>',
    "</div>"
  ].join("");

  const vizEl = document.getElementById("chart2Viz");
  const bodyEl = chartContainer.querySelector(".chart2-body");
  const detailH = 200;
  const overviewH = 100;

  function chartWidth() {
    const w = (bodyEl && bodyEl.clientWidth) || chartContainer.clientWidth || 600;
    return Math.max(280, Math.floor(w));
  }

  function buildSpec(width) {
    return {
      $schema: "https://vega.github.io/schema/vega-lite/v5.json",
      width: width,
      background: "transparent",
      data: { url: "datasets/northern_territory_monthly.csv" },
      vconcat: [
        {
          width: width,
          height: detailH,
          background: "transparent",
          layer: [
            {
              mark: {
                type: "area",
                color: "#e85d2c",
                opacity: 0.45,
                interpolate: "monotone"
              },
              encoding: {
                x: {
                  field: "date",
                  type: "temporal",
                  title: "Month",
                  scale: { domain: { param: "brush" } },
                  axis: {
                    format: "%b %Y",
                    labelColor: "#d4d7dd",
                    titleColor: "#eef1f5"
                  }
                },
                y: {
                  field: "count",
                  type: "quantitative",
                  title: "Hotspot count",
                  scale: { domain: [0, 65000], nice: false },
                  axis: {
                    format: ",d",
                    labelColor: "#d4d7dd",
                    titleColor: "#eef1f5"
                  }
                },
                tooltip: [
                  {
                    field: "date",
                    type: "temporal",
                    title: "Month",
                    format: "%b %Y"
                  },
                  { field: "count", title: "Hotspots", format: "," }
                ]
              }
            },
            {
              data: {
                values: [{
                  px: "2023-10-01", py: 58964,
                  ex: "2020-09-01", ey: 49000,
                  label: "Oct 2023 -- Record peak\n58,964 hotspots in one month\nDriest NT dry season on record"
                }]
              },
              layer: [
                {
                  mark: { type: "rule", color: "#e85d2c", strokeWidth: 1.5, strokeDash: [5, 3] },
                  encoding: {
                    x:  { field: "px", type: "temporal", scale: { domain: { param: "brush" } } },
                    y:  { field: "py", type: "quantitative" },
                    x2: { field: "ex", type: "temporal" },
                    y2: { field: "ey", type: "quantitative" }
                  }
                },
                {
                  mark: { type: "point", color: "#e85d2c", filled: true, size: 80, strokeWidth: 0 },
                  encoding: {
                    x: { field: "px", type: "temporal", scale: { domain: { param: "brush" } } },
                    y: { field: "py", type: "quantitative" }
                  }
                },
                {
                  mark: {
                    type: "text",
                    align: "right",
                    baseline: "middle",
                    dx: -10,
                    color: "#f6efe6",
                    fontSize: 12,
                    fontWeight: 600,
                    lineBreak: "\n",
                    lineHeight: 18
                  },
                  encoding: {
                    x:    { field: "ex",    type: "temporal",    scale: { domain: { param: "brush" } } },
                    y:    { field: "ey",    type: "quantitative" },
                    text: { field: "label" }
                  }
                }
              ]
            }
          ]
        },
        {
          width: width,
          height: overviewH,
          background: "transparent",
          transform: [
            {
              aggregate: [{ op: "sum", field: "count", as: "count" }],
              groupby: ["year"]
            },
            {
              calculate: "datetime(datum.year, 0, 1)",
              as: "date"
            }
          ],
          mark: { type: "area", color: "#e85d2c", opacity: 0.55 },
          params: [
            {
              name: "brush",
              select: { type: "interval", encodings: ["x"] }
            }
          ],
          encoding: {
            x: {
              field: "date",
              type: "temporal",
              title: "Year",
              axis: { format: "%Y", labelColor: "#d4d7dd", titleColor: "#eef1f5" }
            },
            y: {
              field: "count",
              type: "quantitative",
              axis: { tickCount: 3, grid: false, format: ",d", labelColor: "#d4d7dd" }
            }
          }
        }
      ],
      config: {
        background: "transparent",
        view: { stroke: null, fill: "transparent" },
        axis: { gridColor: "rgba(255, 255, 255, 0.08)" }
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
      })
      .catch(function (error) {
        vizEl.innerHTML =
          '<p style="color:#ffd6d6">Chart 2 failed: ' + error.message + "</p>";
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
        '<p style="color:#ffd6d6">Chart 2 failed: ' +
        error.message +
        ". Run a local server (e.g. python3 -m http.server 8080).</p>";
    });
})();
