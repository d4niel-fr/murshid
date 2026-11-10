"""Build the 5-page technical report from the official ITU template.

    python build_report.py   ->  Murshid-ITU-Technical-Report.docx (+ PDF via LibreOffice)

Keeps the template's title block, numbered section headings (List Paragraph, numId 4),
body style and the 'Grid Table Light' mapping table; only the content is replaced.
"""
import copy
import subprocess
from pathlib import Path

from docx import Document
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml.ns import qn
from docx.shared import Pt

HERE = Path(__file__).resolve().parent
OUT = HERE / "Murshid-ITU-Technical-Report.docx"
BODY_PT, TABLE_PT = 11, 8.5

doc = Document(HERE / "template.docx")
body = doc.element.body
paras = doc.paragraphs
H_PROTO = copy.deepcopy(paras[5]._p)          # numbered heading
N_PROTO = copy.deepcopy(paras[6]._p)          # body paragraph
T_PROTO = copy.deepcopy(doc.tables[0]._tbl)   # mapping table


def set_runs(p_el, text, bold_prefix=None, size=BODY_PT, italic=False):
    from docx.text.paragraph import Paragraph
    p = Paragraph(p_el, doc._body)
    for r in list(p.runs):
        r._r.getparent().remove(r._r)
    if bold_prefix:
        r = p.add_run(bold_prefix); r.bold = True; _font(r, size)
    r = p.add_run(text); r.italic = italic; _font(r, size)
    return p


def _font(r, size):
    r.font.size = Pt(size)
    r.font.name = "Times New Roman"
    r._r.get_or_add_rPr().get_or_add_rFonts().set(qn("w:eastAsia"), "Times New Roman")


def spacing(p, after=3, before=0):
    p.paragraph_format.space_after = Pt(after)
    p.paragraph_format.space_before = Pt(before)
    p.paragraph_format.line_spacing = 1.0


# ---- title block (template paragraphs 0-3)
set_runs(paras[0]._p, "AI for Good Lab Hackathon (UAE) – Team Murshid – Murshid: a policy-grounded AI agent for UAE school students", size=12).runs[0].bold = True
set_runs(paras[1]._p, " Vardan (Sam) Kapur, Grade 11 student, GEMS Our Own High School Al Warqa'a, Dubai (the school is the team leader's own school; no partnership or pilot agreement exists).", bold_prefix="Team leader:")
p2 = set_runs(paras[2]._p, " Vardan Kapur (team leader), Daniel Davidson.  Contact: vardan.kapur72@gmail.com", bold_prefix="Team members:")
set_runs(paras[3]._p, " github.com/d4niel-fr/murshid (private)  ·  Live demo (synthetic data): murshid-web.vercel.app/judges", bold_prefix="Github link:")
for p in paras[:4]:
    spacing(p, after=1)

# remove everything after the title block
for el in list(body)[4:]:
    if el.tag != qn("w:sectPr"):
        body.remove(el)
sect = body.find(qn("w:sectPr"))


def add(el):
    sect.addprevious(el)
    return el


def H(text):
    el = add(copy.deepcopy(H_PROTO))
    p = set_runs(el, text, size=11)
    p.runs[0].bold = True
    spacing(p, after=2, before=5)
    p.paragraph_format.keep_with_next = True


def CODE(text, size=7):
    el = add(copy.deepcopy(N_PROTO))
    p = set_runs(el, text, size=size)
    for r in p.runs:
        r.font.name = "Courier New"
        r._r.get_or_add_rPr().get_or_add_rFonts().set(qn("w:eastAsia"), "Courier New")
    p.alignment = WD_ALIGN_PARAGRAPH.LEFT
    spacing(p, after=3)


def P(text, bold=None, size=BODY_PT, after=3, italic=False):
    el = add(copy.deepcopy(N_PROTO))
    p = set_runs(el, text, bold_prefix=bold, size=size, italic=italic)
    spacing(p, after=after)
    return p


def TABLE(header, rows, widths):
    tbl = add(copy.deepcopy(T_PROTO))
    from docx.table import Table
    t = Table(tbl, doc._body)
    while len(t.rows) > 1:
        tbl.remove(t.rows[-1]._tr)
    proto_row = copy.deepcopy(t.rows[0]._tr)
    tbl.remove(t.rows[0]._tr)
    grid = tbl.find(qn("w:tblGrid"))
    for gc in list(grid):
        grid.remove(gc)
    total = 9359
    for w in widths:
        gc = grid.makeelement(qn("w:gridCol"), {qn("w:w"): str(int(total * w))}); grid.append(gc)
    for ri, cells in enumerate([header] + rows):
        tr = copy.deepcopy(proto_row)
        tcs = tr.findall(qn("w:tc"))
        while len(tcs) < len(cells):
            tr.append(copy.deepcopy(tcs[-1])); tcs = tr.findall(qn("w:tc"))
        for extra in tcs[len(cells):]:
            tr.remove(extra)
        tbl.append(tr)
        row = t.rows[-1]
        for ci, txt in enumerate(cells):
            cell = row.cells[ci]
            tcw = cell._tc.get_or_add_tcPr().find(qn("w:tcW"))
            if tcw is not None:
                tcw.set(qn("w:w"), str(int(total * widths[ci])))
            p = cell.paragraphs[0]
            for r in list(p.runs):
                r._r.getparent().remove(r._r)
            for extra in cell.paragraphs[1:]:
                extra._p.getparent().remove(extra._p)
            if isinstance(txt, tuple):
                r = p.add_run(txt[0]); r.bold = True; _font(r, TABLE_PT)
                r = p.add_run(txt[1]); _font(r, TABLE_PT)
            else:
                r = p.add_run(txt); r.bold = ri == 0; _font(r, TABLE_PT)
            p.paragraph_format.space_after = Pt(0)
            p.paragraph_format.line_spacing = 1.0
            p.alignment = WD_ALIGN_PARAGRAPH.LEFT
    return t


def IMG(path, width_cm, caption):
    from docx.shared import Cm
    el = add(copy.deepcopy(N_PROTO))
    p = set_runs(el, "")
    p.runs[0].add_picture(str(HERE / path), width=Cm(width_cm))
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    spacing(p, after=0)
    p.paragraph_format.keep_with_next = True
    c = P(caption, size=9, after=3, italic=True)
    c.alignment = WD_ALIGN_PARAGRAPH.CENTER


exec((HERE / "report_content.py").read_text(), {"H": H, "P": P, "TABLE": TABLE, "IMG": IMG, "CODE": CODE})

doc.save(OUT)
subprocess.run(["soffice", "--headless", "--convert-to", "pdf", "--outdir", str(HERE), str(OUT)], check=True,
               stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
print("wrote", OUT, OUT.with_suffix(".pdf"))
