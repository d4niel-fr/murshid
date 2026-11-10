"""Architecture figure for the report (Y.3172-style pipeline + policy simulation)."""
from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.patches import FancyBboxPatch

OUT = Path(__file__).resolve().parent / "architecture.png"
fig, ax = plt.subplots(figsize=(10, 3.6), dpi=200)
ax.set_xlim(0, 100); ax.set_ylim(0, 36); ax.axis("off")
plt.rcParams["font.family"] = "Liberation Serif"


def box(x, y, w, h, text, fc, fs=8.5, bold=False):
    ax.add_patch(FancyBboxPatch((x, y), w, h, boxstyle="round,pad=0.4,rounding_size=1.2", fc=fc, ec="#333333", lw=0.8))
    ax.text(x + w / 2, y + h / 2, text, ha="center", va="center", fontsize=fs, weight="bold" if bold else "normal", wrap=True)


def arrow(x1, y1, x2, y2, style="-|>", color="#333333", ls="-"):
    ax.annotate("", xy=(x2, y2), xytext=(x1, y1), arrowprops=dict(arrowstyle=style, color=color, lw=0.9, linestyle=ls))


# top row: Y.3172 pipeline of the Murshid agent
nodes = ["SRC\nstudents, teachers,\nschool systems", "C\nconnectors,\nAPI", "PP\nminimise,\npseudonymise,\ncrisis check",
         "M\nlow-cost LLMs\n+ rule engine", "P\nage, consent,\nintegrity, human\napproval", "D\nreplies, reports,\nnotifications", "SINK\nstudent app,\nteacher portal"]
W, G = 12, 2.3
for i, tx in enumerate(nodes):
    box(1 + i * (W + G), 24, W, 9.5, tx, "#e8f1fb", fs=7.5)
    if i:
        arrow(1 + i * (W + G) - G + 0.6, 28.75, 1 + i * (W + G) - 0.6, 28.75)
PX = 1 + 4 * (W + G) + W / 2

# bottom: sandbox / MLFO
box(1, 2, 19, 15, "Knowledge base\n22 official documents\n1,541 chunks (ChromaDB)\nhybrid dense + BM25\nsource, page, article", "#fff4dc", fs=7.5)
box(24, 11, 18, 6, "Coordinator (MLFO role)\nstaged, partial release", "#e9f7ef", fs=7.5, bold=False)
agents = ["Murshid\noperator", "School +\nKHDA", "UAE Data\nOffice", "Ministry of\nEducation", "Child Digital\nSafety Council\n/ TDRA"]
for i, a in enumerate(agents):
    box(46 + i * 10.6, 11, 9.6, 6, a, "#f4ecfb", fs=6.8)
box(24, 2, 18, 6, "Policy & legal adviser\ngaps -> global examples", "#fde8e8", fs=7.5)
box(46, 2, 52, 6, "Audit log (SHA-256 chain): inputs, retrieved + cited chunks, reasoning summary, actions,\nmessages, model, tokens; citation and deadline checks; coordination findings", "#f2f2f2", fs=7)
arrow(42.5, 14, 45.5, 14)
arrow(20.5, 9.5, 23.5, 13.5); arrow(20.5, 9.5, 23.5, 5)
arrow(33, 10.6, 33, 8.4, style="<|-|>")
ax.text(85, 18.4, "agents message each other; delivered one stage later", ha="center", fontsize=6.8, style="italic")
arrow(PX, 23.3, PX, 17.6, color="#777777", ls="--")
ax.text(PX + 1, 20.6, "policy node backed by the simulation (Y.3172 ML sandbox)", fontsize=6.8, color="#555555")
plt.savefig(OUT, bbox_inches="tight", facecolor="white")
print("wrote", OUT)
