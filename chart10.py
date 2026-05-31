"""
Chart 10 - Small Multiples: Community Preparedness Score Distribution
NT Community Bushfire Risk Dataset

2x2 grid of 100%-stacked horizontal bar charts comparing the
distribution of preparedness scores across four categorical dimensions:
  - Risk Level (RATING)
  - Community Type (COMMTYPE)
  - Fire Management Zone (FMZONE)
  - Regional Council (LGA, top 8 + Other)

Preparedness score = FUELREDUC + FIREBREAK + FIREPLAN  (each Yes = 1)
Range: 0 (none) -> 3 (all three measures in place)

Run from the project root:
    python3 chart10.py
Output: assets/chart10_preparedness.png
"""

import pandas as pd
import matplotlib.pyplot as plt
import matplotlib.patches as mpatches
import numpy as np
from pathlib import Path

# -- Paths --------------------------------------------------------------------
DATA_PATH = Path("datasets/Community_Bushfire_Risk.csv")
OUT_PATH  = Path("assets/chart10_preparedness.png")
OUT_PATH.parent.mkdir(parents=True, exist_ok=True)

# -- Theme colours (matches the dark web project) ------------------------------
BG       = "#07060a"
PANEL_BG = "#110d10"
INK_0    = "#f6efe6"
INK_2    = "#908880"
GRID     = "#1e1a1e"
EMBER    = "#e85d2c"

PREP_COLORS = {
    "Unprepared (0/3)": "#8b2500",
    "Low (1/3)":        "#d4701f",
    "Mostly (2/3)":     "#c49a2b",
    "Full (3/3)":       "#5a8e4a",
}
PREP_ORDER = list(PREP_COLORS.keys())
TOP_LGA = 8

# -- Load & derive --------------------------------------------------------------
df = pd.read_csv(DATA_PATH)

# Preparedness score (0-3)
for col in ["FUELREDUC", "FIREBREAK", "FIREPLAN"]:
    df[col] = df[col].str.strip().str.lower()

df["prep_score"] = (
    df["FUELREDUC"].eq("yes").astype(int) +
    df["FIREBREAK"].eq("yes").astype(int) +
    df["FIREPLAN"].eq("yes").astype(int)
)
LABEL_MAP = {
    0: "Unprepared (0/3)",
    1: "Low (1/3)",
    2: "Mostly (2/3)",
    3: "Full (3/3)",
}
df["prep_label"] = df["prep_score"].map(LABEL_MAP)

# LGA: top N + Other
df["LGA"] = df["LGA"].str.strip()
top_lgas  = df["LGA"].value_counts().head(TOP_LGA).index
df["lga_group"] = np.where(df["LGA"].isin(top_lgas), df["LGA"], "Other")

# Shorten long council names for label readability
NAME_MAP = {
    "MacDonnell Regional Council":    "MacDonnell",
    "East Arnhem Regional Council":   "East Arnhem",
    "Roper Gulf Regional Council":    "Roper Gulf",
    "West Arnhem Regional Council":   "West Arnhem",
    "Barkly Regional Council":        "Barkly",
    "Central Desert Regional Council":"Central Desert",
    "Victoria-Daly Regional Council": "Victoria-Daly",
    "Alice Springs Town Council":     "Alice Springs TC",
}
df["lga_group"] = df["lga_group"].replace(NAME_MAP)

# -- Build percentage pivot helper --------------------------------------------
def build_pivot(series_group, series_prep):
    ct = pd.crosstab(series_group, series_prep)
    ct = ct.reindex(columns=PREP_ORDER, fill_value=0)
    pct = ct.div(ct.sum(axis=1), axis=0) * 100
    totals = ct.sum(axis=1)
    # Sort ascending so largest bar is at top (matplotlib barh goes bottom to top)
    order = totals.sort_values(ascending=True).index
    return pct.loc[order], ct.loc[order]

panels = [
    ("RATING",     "By Risk Level",           "RATING"),
    ("COMMTYPE",   "By Community Type",        "COMMTYPE"),
    ("FMZONE",     "By Fire Management Zone",  "FMZONE"),
    ("lga_group",  "By Regional Council",      "lga_group"),
]

# -- Figure layout ------------------------------------------------------------
fig, axes = plt.subplots(2, 2, figsize=(20, 13), facecolor=BG)
fig.patch.set_facecolor(BG)
fig.subplots_adjust(left=0.14, right=0.97, top=0.88, bottom=0.10,
                    wspace=0.42, hspace=0.55)

for ax, (col, title, _) in zip(axes.flat, panels):
    pct, raw = build_pivot(df[col], df["prep_label"])

    ax.set_facecolor(PANEL_BG)
    for sp in ax.spines.values():
        sp.set_color(GRID)

    # Stacked horizontal bars
    lefts = np.zeros(len(pct))
    for pl in PREP_ORDER:
        vals = pct[pl].values
        bars = ax.barh(
            range(len(pct)),
            vals,
            left=lefts,
            color=PREP_COLORS[pl],
            height=0.68,
            edgecolor="none",
            zorder=3,
        )
        # Percentage labels inside segments >= 9%
        for i, (v, l) in enumerate(zip(vals, lefts)):
            if v >= 9:
                ax.text(
                    l + v / 2, i,
                    f"{v:.0f}%",
                    ha="center", va="center",
                    color=INK_0, fontsize=8.5,
                    fontweight="bold",
                    fontfamily="monospace",
                    zorder=4,
                )
        lefts += vals

    # Y-axis: category labels
    ax.set_yticks(range(len(pct)))
    ax.set_yticklabels(pct.index, color=INK_0, fontsize=11)
    ax.tick_params(axis="y", length=0, pad=6)

    # X-axis
    ax.set_xlim(0, 100)
    ax.set_xticks([0, 25, 50, 75, 100])
    ax.set_xticklabels(["0%", "25%", "50%", "75%", "100%"],
                       color=INK_2, fontsize=9)
    ax.tick_params(axis="x", length=0, pad=4)
    ax.set_axisbelow(True)
    ax.xaxis.grid(True, color=GRID, linewidth=0.8, zorder=0)
    ax.yaxis.grid(False)

    # Panel title
    ax.set_title(title, color=INK_0, fontsize=13, fontweight="bold",
                 loc="left", pad=10)

    # n= annotation bottom-right
    ax.text(
        99, -0.6,
        f"n = {int(raw.sum().sum())}",
        ha="right", va="bottom",
        color=INK_2, fontsize=9, fontfamily="monospace",
        transform=ax.transData,
    )

# -- Legend --------------------------------------------------------------------
patches = [mpatches.Patch(color=PREP_COLORS[pl], label=pl) for pl in PREP_ORDER]
fig.legend(
    handles=patches,
    loc="lower center",
    ncol=4,
    frameon=False,
    fontsize=11,
    labelcolor=INK_0,
    title="Preparedness tier  (measures in place out of 3: fuel reduction, firebreak, fire plan)",
    title_fontsize=9.5,
    bbox_to_anchor=(0.5, 0.01),
)

# -- Top title block ----------------------------------------------------------
fig.text(
    0.5, 0.95,
    "Community Preparedness Score by Group",
    ha="center", color=INK_0,
    fontsize=19, fontweight="bold",
)
fig.text(
    0.5, 0.915,
    "Each bar = proportion of communities at each preparedness level."
    "  Score = fuel reduction + firebreak + fire plan (0-3)."
    "  Same scale across all panels.",
    ha="center", color=INK_2, fontsize=10.5,
)

# -- Ember accent line under title --------------------------------------------
fig.add_artist(plt.Line2D(
    [0.38, 0.62], [0.905, 0.905],
    transform=fig.transFigure,
    color=EMBER, linewidth=1.2,
))

# -- Save ----------------------------------------------------------------------
plt.savefig(OUT_PATH, dpi=150, bbox_inches="tight", facecolor=BG)
plt.close()
print(f"Saved to {OUT_PATH}")
