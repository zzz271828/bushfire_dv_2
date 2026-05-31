(function () {
  const chartContainer = document.getElementById("chart1");
  if (!chartContainer || typeof vegaEmbed === "undefined") return;

  chartContainer.innerHTML = [
    '<h2 class="chart1-title">Australia Bushfire Hotspots by State</h2>',
    '<div class="chart1-body">',
    '  <div id="chart1Map"></div>',
    '  <div class="chart1-controls">',
    '    <label for="chart1Year">Year <span id="chart1YearValue">2023</span></label>',
    '    <input id="chart1Year" type="range" min="2014" max="2024" step="1" value="2023" />',
    "  </div>",
    "</div>"
  ].join("");

  const yearInput = document.getElementById("chart1Year");
  const yearValue = document.getElementById("chart1YearValue");
  const mapContainer = document.getElementById("chart1Map");

  const fireCsv = `year,state,count
2014,Australian Capital Territory,12
2014,New South Wales,8986
2014,Northern Territory,77443
2014,Queensland,43102
2014,South Australia,3955
2014,Tasmania,619
2014,Victoria,6597
2014,Western Australia,65334
2015,Australian Capital Territory,30
2015,New South Wales,8202
2015,Northern Territory,86797
2015,Queensland,31663
2015,South Australia,1865
2015,Tasmania,616
2015,Victoria,3766
2015,Western Australia,59313
2016,Australian Capital Territory,52
2016,New South Wales,10643
2016,Northern Territory,38008
2016,Queensland,37164
2016,South Australia,1410
2016,Tasmania,1701
2016,Victoria,2402
2016,Western Australia,35784
2017,Australian Capital Territory,30
2017,New South Wales,14689
2017,Northern Territory,75821
2017,Other Territories,12
2017,Queensland,35315
2017,South Australia,3474
2017,Tasmania,686
2017,Victoria,4217
2017,Western Australia,88995
2018,Australian Capital Territory,20
2018,New South Wales,13320
2018,Northern Territory,76893
2018,Queensland,49527
2018,South Australia,3883
2018,Tasmania,715
2018,Victoria,4292
2018,Western Australia,99556
2019,Australian Capital Territory,17
2019,New South Wales,63743
2019,Northern Territory,58408
2019,Queensland,42109
2019,South Australia,3954
2019,Tasmania,2982
2019,Victoria,9357
2019,Western Australia,69297
2020,Australian Capital Territory,1564
2020,New South Wales,16229
2020,Northern Territory,29617
2020,Queensland,36785
2020,South Australia,2008
2020,Tasmania,744
2020,Victoria,11002
2020,Western Australia,24499
2021,Australian Capital Territory,5
2021,New South Wales,9767
2021,Northern Territory,51953
2021,Queensland,32432
2021,South Australia,1098
2021,Tasmania,489
2021,Victoria,3720
2021,Western Australia,38116
2022,Australian Capital Territory,4
2022,New South Wales,4854
2022,Northern Territory,55182
2022,Queensland,26849
2022,South Australia,1026
2022,Tasmania,395
2022,Victoria,1820
2022,Western Australia,37493
2023,Australian Capital Territory,9
2023,New South Wales,14103
2023,Northern Territory,136961
2023,Queensland,62751
2023,South Australia,4440
2023,Tasmania,499
2023,Victoria,3757
2023,Western Australia,97033
2024,Australian Capital Territory,11
2024,New South Wales,7923
2024,Northern Territory,70664
2024,Queensland,60639
2024,South Australia,1330
2024,Tasmania,649
2024,Victoria,5095
2024,Western Australia,33115`;

  const lines = fireCsv.trim().split(/\r?\n/);
  const rows = lines.slice(1).map(function (line) {
    const parts = line.split(",");
    return {
      year: Number(parts[0]),
      state: parts[1],
      count: Number(parts[2])
    };
  });

  const fireLookup = {};
  let countMax = 0;
  rows.forEach(function (d) {
    fireLookup[d.state + "|" + d.year] = d.count;
    if (d.count > countMax) countMax = d.count;
  });

  let geojsonCache = null;
  let lastEmbed = null;

  function getGeoJson() {
    if (typeof window.__AU_STATES_GEOJSON__ !== "undefined") {
      return Promise.resolve(window.__AU_STATES_GEOJSON__);
    }
    return fetch("datasets/australia_states.geojson")
      .then(function (r) {
        if (!r.ok) {
          throw new Error("HTTP " + r.status + " for australia_states.geojson");
        }
        return r.json();
      })
      .then(function (g) {
        window.__AU_STATES_GEOJSON__ = g;
        return g;
      });
  }

  function embedMap(geojson, year) {
    yearValue.textContent = String(year);

    if (!geojson || geojson.type !== "FeatureCollection" || !geojson.features) {
      mapContainer.innerHTML =
        '<p style="color:#ffd6d6">Invalid map data: expected FeatureCollection with features.</p>';
      return Promise.resolve();
    }

    const values = geojson.features.map(function (feature) {
      const state = feature.properties.STATE_NAME;
      const count = fireLookup[state + "|" + year];
      return {
        geometry: feature.geometry,
        state: state,
        year: year,
        count: Number.isFinite(count) ? count : 0
      };
    });

    if (lastEmbed && typeof lastEmbed.finalize === "function") {
      try {
        lastEmbed.finalize();
      } catch (e) {
        /* ignore */
      }
      lastEmbed = null;
    }
    mapContainer.innerHTML = "";

    const body = chartContainer.querySelector(".chart1-body");
    const bodyW = (body && body.clientWidth) || chartContainer.clientWidth || 900;
    const MAP_W = Math.min(Math.round(bodyW * 0.9), 700);
    const MAP_H = Math.round(MAP_W * 0.68);
    const projScale = Math.round(Math.min(MAP_W * 1.06, MAP_H * 1.48));

    const legendMax = Math.ceil(countMax / 50000) * 50000;
    const legendTicks = [0, 50000, 100000, legendMax];

    const spec = {
      $schema: "https://vega.github.io/schema/vega-lite/v5.json",
      width: MAP_W,
      height: MAP_H,
      background: "transparent",
      padding: { left: 0, top: 0, right: 4, bottom: 0 },
      data: { values: values },
      projection: {
        type: "mercator",
        rotate: [-132, 0, 0],
        center: [0, -28],
        scale: projScale,
        translate: [MAP_W / 2, MAP_H / 2]
      },
      mark: { type: "geoshape", stroke: "#0f1115", strokeWidth: 1 },
      encoding: {
        shape: { field: "geometry", type: "geojson" },
        color: {
          field: "count",
          type: "quantitative",
          scale: {
            type: "linear",
            domain: [0, countMax],
            range: [
              "#fff7ec",
              "#fee8c8",
              "#fdd49e",
              "#fdbb84",
              "#fc8d59",
              "#ef6548",
              "#d7301f",
              "#a50026",
              "#67000d"
            ],
            nice: false
          },
          legend: {
            title: "Hotspot count",
            orient: "right",
            gradientLength: Math.min(165, MAP_H - 72),
            values: legendTicks,
            format: ",d",
            labelOverlap: false,
            titlePadding: 20,
            labelPadding: 8,
            offset: 6
          }
        },
        tooltip: [
          { field: "state", title: "State" },
          { field: "year", title: "Year" },
          { field: "count", type: "quantitative", title: "Hotspots", format: "," }
        ]
      },
      config: {
        view: { stroke: null },
        numberFormat: ",d",
        legend: {
          labelColor: "#d4d7dd",
          titleColor: "#f0f2f5",
          labelFontSize: 11,
          titleFontSize: 12,
          titlePadding: 14,
          labelOffset: 4
        }
      }
    };

    return vegaEmbed(mapContainer, spec, { actions: false })
      .then(function (result) {
        lastEmbed = result;
      })
      .catch(function (error) {
        mapContainer.innerHTML =
          '<p style="color:#ffd6d6">Vega-Lite failed: ' + error.message + "</p>";
      });
  }

  function render(year) {
    if (geojsonCache) {
      embedMap(geojsonCache, year);
      return;
    }

    getGeoJson()
      .then(function (geojson) {
        geojsonCache = geojson;
        return embedMap(geojsonCache, year);
      })
      .catch(function (error) {
        mapContainer.innerHTML =
          '<p style="color:#ffd6d6">Map data failed: ' +
          error.message +
          "</p>";
      });
  }

  render(Number(yearInput.value));
  yearInput.addEventListener("input", function () {
    render(Number(yearInput.value));
  });
})();