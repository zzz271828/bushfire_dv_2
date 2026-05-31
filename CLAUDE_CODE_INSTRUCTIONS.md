# NT Bushfire Dashboard — Redesign Handoff

This package contains a redesigned version of your dashboard plus a redrawn hero, a glowing fireball cursor with a spark trail, and two `firesparks.mov` video passes (one behind everything, one composited over the charts).

The new design **does not** rewrite any of your Vega-Lite chart specs. It only changes the surrounding shell so the existing `chartN.js` files mount into well-defined, well-styled containers.

---

## TL;DR — Two ways to apply this

### Option A · Replace the index.html outright (recommended)

1. Copy **`When the North Burns.html`** into your project root.
2. Rename it to **`index.html`** (or keep both — they don't conflict).
3. Make sure these paths exist next to it (they already do in your project, no changes needed):

   ```
   assets/
     bushfire.png            # already there
     firesparks.mov          # already there — the two video layers reference this exact path
   datasets/
     australia_states_global.js
     australia_states.geojson
     northern_territory_hotspots.csv
     northern_territory_monthly.csv
     Community_Bushfire_Risk.csv
     australia_fires_yearly_summary.csv
   js/
     northern_territory.topojson
     charts/
       chart1.js  chart2.js  chart3.js  chart4.js
       chart5.js  chart6.js  chart7.js  chart8.js
       community-data.js
       timeOfDay2023-data.js
   ```

4. Delete (or stop using) the old `css/style.css` and `js/main.js` — the new file is self-contained. If you want to keep them around as reference, just don't link them.

5. Open `index.html` through a local server (the Vega-Lite scripts use `fetch` for CSV/geojson):

   ```bash
   python3 -m http.server 8080
   ```

That's it. No script changes required.

---

### Option B · Patch the existing index.html in place

If you'd rather keep your current `index.html` and only graft the new shell on, ask Claude Code to do this exact sequence:

1. **Replace the `<head>` block** with the new one in `When the North Burns.html` (Google Font imports, design tokens, the full `<style>` block). The old `css/style.css` becomes redundant.

2. **Replace the `<body>` markup** between `<body>` and the closing Vega script tags with the new structure from `When the North Burns.html`:
   - new hero with the "WHEN / Northern Territory Burns / 2014–2024" treatment
   - new `.dashboard > .grid > .section` layout
   - new `.chart-frame` containers (each with a header + a `.chart-stage` mount point that keeps your original `id="chartN"`)

3. **Add the two fire-spark video layers**:

   ```html
   <!-- behind everything -->
   <div class="spark-layer spark-back" aria-hidden="true">
     <video src="assets/firesparks.mov" autoplay loop muted playsinline preload="auto"></video>
   </div>

   <!-- ...everything else... -->

   <!-- on top of everything, mix-blend screen, pointer-events:none -->
   <div class="spark-layer spark-front" aria-hidden="true">
     <video src="assets/firesparks.mov" autoplay loop muted playsinline preload="auto"></video>
   </div>
   ```

4. **Add the fireball cursor markup + script** (canvas + the `<script>(function () { … })()</script>` block at the bottom of the new file). Copy these verbatim — they don't depend on any of your other code.

5. **Add the placeholder hand-off `MutationObserver` script** (also at the bottom of the new file). It hides the placeholder cards in each `.chart-stage` as soon as a real chart paints into them.

6. **Keep your existing `<script src="js/charts/chartN.js" defer>` tags** — the new HTML still mounts them by ID, so nothing in `chartN.js` needs to change.

7. **Delete the link to the old `css/style.css`** and the old `js/main.js` scroll-fader — both are replaced.

---

## What each chart container looks like

Every chart slot in the new HTML follows this exact pattern. Each one has a clear comment header so you (or Claude Code) can find it later:

```html
<!-- ============================================================
     CHART SLOT · CHART N · <title>
     vega-lite spec lives in: js/charts/chartN.js
     Mount target id:        #chartN
     Container size:         frame-h-tall / frame-h-med / frame-h-short
                             / frame-aspect-1 / frame-aspect-4-3 / frame-aspect-16-9
     Spec hints:
       - width: "container", height: "container"
       - background: "transparent"
     ============================================================ -->
<div class="chart-frame frame-h-med" data-chart="chartN">
  <div class="chart-head">
    <span class="chart-id">Chart 0N</span>
    <h3 class="chart-title">…</h3>
  </div>
  <p class="chart-sub">…</p>
  <!-- VEGA-LITE MOUNT POINT — do not rename id="chartN" -->
  <div class="chart-stage" id="chartN">
    <div class="placeholder">…</div>
  </div>
</div>
```

Important rules:

- **Keep `id="chartN"` exactly as-is** — your chart scripts target it by ID.
- The `.placeholder` is shown until a chart actually paints. The MutationObserver at the bottom of the file flips a `.has-chart` class on the stage; the placeholder hides automatically.
- The CSS rule `.chart-stage > .chart1-title { display: none }` deliberately hides the inner `<h2 class="chart1-title">` that each chart script writes — the outer `.chart-frame` header already provides the title, and we don't want duplicates.
- Each chart script also writes a `.chartN-body` wrapper and various toolbars/legends — those are styled to match the new theme in the CSS (search for `.chart-stage .chart4-toolbar`, `.chart-stage .chart6-svg`, etc.).

If you need to add new charts later, copy the block above and pick a sensible container size from the list.

---

## Container size helpers

```
.frame-h-tall      min-height: 560px
.frame-h-med       min-height: 440px
.frame-h-short     min-height: 320px
.frame-aspect-1    aspect-ratio: 1 / 1
.frame-aspect-4-3  aspect-ratio: 4 / 3
.frame-aspect-16-9 aspect-ratio: 16 / 9
```

Apply one to a `.chart-frame` to give the chart a predictable canvas to draw into.

---

## The fireball cursor

The cursor is a fixed-position `.fireball` div (three nested radial gradients — halo, glow, hot core, plus a tiny flicker animation) layered on top of a `<canvas class="spark-canvas">` that draws additive HSL spark particles in `globalCompositeOperation = "lighter"` mode. The script lives at the bottom of the file and:

- smoothly chases the real mouse position with lerp
- spawns more sparks the faster you move
- gives sparks a slight upward bias and a 600–1300 ms life
- caps particles at 220
- adds an idle crackle so the ball still gives off light when still
- bails out entirely on `(hover: none)` touch devices

The default OS cursor is hidden globally (`html, body, input, … { cursor: none }`). Form controls (sliders, buttons) still work — only the *visible* cursor changes.

If you ever need the OS cursor back (debugging or accessibility), comment out the `cursor: none` lines in the `html, body, …` rules near the top of the `<style>` block.

---

## The two fire-spark video layers

Both layers reference `assets/firesparks.mov` directly:

```css
.spark-back  { z-index: 0;  opacity: 0.85; }
.spark-front { z-index: 60; mix-blend-mode: screen; opacity: 0.55; }
```

- **Back layer**: drawn behind the hero image and the dashboard background. Adds atmosphere to the deep page tone.
- **Front layer**: drawn on top of everything with `mix-blend-mode: screen` and `pointer-events: none`, so only the bright sparks show through — dark video pixels disappear. This is what makes embers appear to rain *over* your charts without blocking interaction.

If the sparks feel too strong or too weak:

- adjust `opacity` on either layer (0.0 – 1.0)
- swap `mix-blend-mode: screen` for `lighten` (more subtle) or `plus-lighter` (more intense)
- raise/lower z-index on `.spark-front` to put sparks above or below specific UI

Layers respect `prefers-reduced-motion` automatically (hidden when the user's OS asks for it).

---

## Why chart 4 may render an error message in some environments

`chart4.js` fetches `datasets/northern_territory_hotspots.csv` which is ~30+ MB. As long as that file is next to the HTML at the path above and you're serving over HTTP, it will work. If you see a "Run a local server" message in the chart 4 frame, you're either opening the file with `file://` or the CSV is missing.

---

## Files in this handoff

```
When the North Burns.html       ← the new shell (drop-in replacement for index.html)
CLAUDE_CODE_INSTRUCTIONS.md     ← this document
assets/bushfire.png             ← used by the hero
                                  (assets/firesparks.mov stays in your local project —
                                   it's too large to ship through this channel)
datasets/                       ← all your CSV/geojson (minus the >30 MB hotspots CSV)
js/charts/                      ← unchanged copies of your existing chart scripts
js/northern_territory.topojson  ← unchanged
```

If anything in your local copy is newer than what's in this handoff, **trust your local copy** — no chart script has been modified.
