#!/usr/bin/env python3
"""
DFIR Case Report Generator
Generates a professional forensic PDF report.

If ANY evidence hash fails verification the report:
  1. Shows a full-page red CRITICAL WARNING immediately after the cover
  2. Flags the cover page itself in red with a banner
  3. Every page header turns red throughout the whole document
  4. Opens Section 3 with a multi-line danger banner listing affected items
  5. Highlights every failed row red in the summary integrity table
  6. Renders a side-by-side stored vs computed hash diff for each failed item
     with upper-cased characters showing the exact positions that differ
  7. Each detailed evidence record has a coloured integrity status row
  8. The sign-off page is marked COMPROMISED and signature block is conditional

Usage:
    python3 generate_report.py --input case_data.json --output report.pdf
"""

import sys
import json
import argparse
import os
from datetime import datetime

from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import mm, cm
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_RIGHT, TA_JUSTIFY
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    PageBreak, HRFlowable, KeepTogether,
)
from reportlab.platypus.flowables import Flowable
from reportlab.pdfgen import canvas as pdfcanvas

# ── Palette ────────────────────────────────────────────────────────────────────
DARK_NAVY    = colors.HexColor("#1a2332")
MID_NAVY     = colors.HexColor("#2d3f55")
ACCENT_BLUE  = colors.HexColor("#3b82f6")
SLATE        = colors.HexColor("#64748b")
LIGHT_GRAY   = colors.HexColor("#f1f5f9")
MED_GRAY     = colors.HexColor("#e2e8f0")
WHITE        = colors.white
SUCCESS      = colors.HexColor("#16a34a")
SUCCESS_BG   = colors.HexColor("#dcfce7")
SUCCESS_BRD  = colors.HexColor("#86efac")
DANGER       = colors.HexColor("#dc2626")
DANGER_DARK  = colors.HexColor("#991b1b")
DANGER_BG    = colors.HexColor("#fef2f2")
DANGER_DEEP  = colors.HexColor("#fee2e2")
DANGER_BRD   = colors.HexColor("#fca5a5")
CRITICAL_RED = colors.HexColor("#b91c1c")
CRITICAL_BG  = colors.HexColor("#3b0a0a")  # near-black red for full-page warning
WARNING      = colors.HexColor("#d97706")
WARN_BG      = colors.HexColor("#fffbeb")

PAGE_W, PAGE_H = A4
MARGIN = 2.0 * cm


# ── Custom Flowables ───────────────────────────────────────────────────────────
class ColorBar(Flowable):
    def __init__(self, color, height=4):
        super().__init__()
        self.color  = color
        self.height = height
        self.width  = PAGE_W - 2 * MARGIN

    def draw(self):
        self.canv.setFillColor(self.color)
        self.canv.rect(0, 0, self.width, self.height, fill=1, stroke=0)


class SectionHeader(Flowable):
    def __init__(self, text, width=None, danger=False):
        super().__init__()
        self.text   = text
        self.width  = width or (PAGE_W - 2 * MARGIN)
        self.height = 28
        self.danger = danger

    def draw(self):
        c  = self.canv
        bg = DANGER_BG if self.danger else LIGHT_GRAY
        ac = DANGER    if self.danger else ACCENT_BLUE
        fg = DANGER    if self.danger else DARK_NAVY
        c.setFillColor(bg)
        c.roundRect(0, 0, self.width, self.height, 4, fill=1, stroke=0)
        c.setFillColor(ac)
        c.rect(0, 0, 4, self.height, fill=1, stroke=0)
        c.setFillColor(fg)
        c.setFont("Helvetica-Bold", 11)
        prefix = "WARNING  " if self.danger else ""
        c.drawString(14, 9, (prefix + self.text).upper())


class PageNumCanvas(pdfcanvas.Canvas):
    def __init__(self, *args, case_number="", report_date="",
                 integrity_failed=False, **kwargs):
        super().__init__(*args, **kwargs)
        self._saved_page_states = []
        self.case_number      = case_number
        self.report_date      = report_date
        self.integrity_failed = integrity_failed

    def showPage(self):
        self._saved_page_states.append(dict(self.__dict__))
        self._startPage()

    def save(self):
        total = len(self._saved_page_states)
        for state in self._saved_page_states:
            self.__dict__.update(state)
            self._draw_chrome(self._pageNumber, total)
            super().showPage()
        super().save()

    def _draw_chrome(self, page_num, total):
        self.saveState()
        w, h = A4

        if page_num > 1:
            hdr_color = CRITICAL_RED if self.integrity_failed else DARK_NAVY
            self.setFillColor(hdr_color)
            self.rect(0, h - 18*mm, w, 18*mm, fill=1, stroke=0)
            self.setFillColor(WHITE)
            self.setFont("Helvetica-Bold", 9)
            suffix = "   WARNING: INTEGRITY FAILURE" if self.integrity_failed else ""
            self.drawString(MARGIN, h - 11*mm, f"DFIR CASE REPORT  |  CONFIDENTIAL{suffix}")
            self.setFont("Helvetica", 8)
            self.drawRightString(w - MARGIN, h - 11*mm,
                                 f"Case: {self.case_number}   |   {self.report_date}")

        # Footer
        footer_bg = colors.HexColor("#fecaca") if self.integrity_failed else MED_GRAY
        self.setFillColor(footer_bg)
        self.rect(0, 0, w, 12*mm, fill=1, stroke=0)
        self.setFillColor(SLATE)
        self.setFont("Helvetica", 7.5)
        self.drawString(MARGIN, 4*mm,
                        "Confidential — DFIR Case Management System — Authorised recipients only.")
        self.setFont("Helvetica-Bold", 8)
        self.drawRightString(w - MARGIN, 4*mm, f"Page {page_num} of {total}")
        self.restoreState()


# ── Styles ─────────────────────────────────────────────────────────────────────
def make_styles():
    base = getSampleStyleSheet()
    def ps(name, **kw):
        return ParagraphStyle(name, parent=base["Normal"], **kw)
    return {
        "title":        ps("T",   fontName="Helvetica-Bold", fontSize=28,
                           textColor=WHITE,       spaceAfter=4,  leading=34),
        "subtitle":     ps("S",   fontName="Helvetica",      fontSize=13,
                           textColor=colors.HexColor("#93c5fd"), spaceAfter=6),
        "cover_meta":   ps("CM",  fontName="Helvetica",      fontSize=10,
                           textColor=colors.HexColor("#cbd5e1"), spaceAfter=3),
        "cover_crit":   ps("CC",  fontName="Helvetica-Bold", fontSize=12,
                           textColor=colors.HexColor("#fca5a5"), spaceAfter=4),
        "body":         ps("B",   fontName="Helvetica",      fontSize=9.5,
                           textColor=DARK_NAVY,  spaceAfter=6,  leading=15),
        "body_j":       ps("BJ",  fontName="Helvetica",      fontSize=9.5,
                           textColor=DARK_NAVY,  spaceAfter=6,  leading=15,
                           alignment=TA_JUSTIFY),
        "label":        ps("L",   fontName="Helvetica-Bold", fontSize=9,
                           textColor=SLATE,      spaceAfter=2),
        "value":        ps("V",   fontName="Helvetica",      fontSize=9.5,
                           textColor=DARK_NAVY,  spaceAfter=4),
        "warn":         ps("W",   fontName="Helvetica-Bold", fontSize=9,
                           textColor=WARNING,    spaceAfter=4),
        "ok":           ps("OK",  fontName="Helvetica-Bold", fontSize=9,
                           textColor=SUCCESS,    spaceAfter=4),
        "ok_lg":        ps("OKL", fontName="Helvetica-Bold", fontSize=12,
                           textColor=SUCCESS,    spaceAfter=6),
        "fail":         ps("F",   fontName="Helvetica-Bold", fontSize=9,
                           textColor=DANGER,     spaceAfter=4),
        "fail_lg":      ps("FL",  fontName="Helvetica-Bold", fontSize=12,
                           textColor=DANGER,     spaceAfter=6),
        "critical":     ps("CR",  fontName="Helvetica-Bold", fontSize=16,
                           textColor=WHITE,      spaceAfter=8,  leading=20),
        "critical_sub": ps("CRS", fontName="Helvetica",      fontSize=10,
                           textColor=colors.HexColor("#fca5a5"), spaceAfter=6, leading=15),
        "toc_entry":    ps("TE",  fontName="Helvetica",      fontSize=10,
                           textColor=DARK_NAVY,  spaceAfter=5),
        "toc_title":    ps("TT",  fontName="Helvetica-Bold", fontSize=10,
                           textColor=DARK_NAVY,  spaceAfter=5),
        "toc_warn":     ps("TW",  fontName="Helvetica-Bold", fontSize=10,
                           textColor=DANGER,     spaceAfter=5),
        "th":           ps("TH",  fontName="Helvetica-Bold", fontSize=8.5,
                           textColor=WHITE,      alignment=TA_CENTER),
        "td":           ps("TD",  fontName="Helvetica",      fontSize=8,
                           textColor=DARK_NAVY,  leading=11),
        "td_fail":      ps("TDF", fontName="Helvetica-Bold", fontSize=8,
                           textColor=DANGER,     leading=11),
        "td_pass":      ps("TDP", fontName="Helvetica-Bold", fontSize=8,
                           textColor=SUCCESS,    leading=11),
        "mono":         ps("M",   fontName="Courier",        fontSize=7.5,
                           textColor=MID_NAVY,   spaceAfter=3,  leading=11),
        "mono_pass":    ps("MP",  fontName="Courier-Bold",   fontSize=8,
                           textColor=SUCCESS,    spaceAfter=2,  leading=12),
        "mono_fail":    ps("MF",  fontName="Courier-Bold",   fontSize=8,
                           textColor=DANGER,     spaceAfter=2,  leading=12),
        "hash_label":   ps("HL",  fontName="Helvetica-Bold", fontSize=8,
                           textColor=SLATE,      spaceAfter=1),
        "note":         ps("N",   fontName="Helvetica-Oblique", fontSize=8.5,
                           textColor=SLATE,      spaceAfter=4),
    }


S = make_styles()


# ── Helpers ────────────────────────────────────────────────────────────────────
def p(text, style="body"):
    return Paragraph(str(text) if text else "", S[style])

def sp(h=6):
    return Spacer(1, h)

def hr(color=MED_GRAY, thickness=0.5):
    return HRFlowable(width="100%", thickness=thickness, color=color, spaceAfter=6)

def fmt_date(val):
    if not val:
        return "—"
    try:
        d = datetime.fromisoformat(str(val).replace("Z", "+00:00"))
        return d.strftime("%d %b %Y  %H:%M:%S UTC")
    except Exception:
        return str(val)

def na(val):
    return str(val) if val else "—"

def _fmt_size(b):
    if b is None:
        return "—"
    try:
        b = int(b)
        for u in ["B","KB","MB","GB"]:
            if b < 1024:
                return f"{b:.1f} {u}"
            b /= 1024
        return f"{b:.1f} TB"
    except Exception:
        return str(b)

def _diff_hashes(h1, h2):
    """Return copies of both hashes; positions where they differ are upper-cased."""
    if not h1 or not h2 or len(h1) != len(h2):
        return h1 or "—", h2 or "—"
    out1, out2 = [], []
    for a, b in zip(h1, h2):
        out1.append(a.upper() if a != b else a)
        out2.append(b.upper() if a != b else b)
    return "".join(out1), "".join(out2)

def kv_table(rows, col_widths=None, danger_last=False):
    usable = PAGE_W - 2 * MARGIN
    w = col_widths or [usable * 0.32, usable * 0.68]
    data = [[p(k, "label"), p(v, "value")] for k, v in rows]
    t = Table(data, colWidths=w)
    cmds = [
        ("VALIGN",        (0,0),(-1,-1),"TOP"),
        ("ROWBACKGROUNDS",(0,0),(-1,-1),[WHITE, LIGHT_GRAY]),
        ("LEFTPADDING",   (0,0),(-1,-1),8),
        ("RIGHTPADDING",  (0,0),(-1,-1),8),
        ("TOPPADDING",    (0,0),(-1,-1),5),
        ("BOTTOMPADDING", (0,0),(-1,-1),5),
        ("LINEBELOW",     (0,0),(-1,-2),0.3,MED_GRAY),
    ]
    if danger_last:
        last = len(rows) - 1
        cmds += [
            ("BACKGROUND",(0,last),(-1,last), DANGER_DEEP),
            ("TEXTCOLOR", (1,last),(1,last),  DANGER),
            ("FONTNAME",  (1,last),(1,last),  "Helvetica-Bold"),
        ]
    t.setStyle(TableStyle(cmds))
    return t

def data_table(headers, rows, col_widths=None, small=False,
               danger_header=False, fail_rows=None):
    usable = PAGE_W - 2 * MARGIN
    if not col_widths:
        col_widths = [usable / len(headers)] * len(headers)
    fail_rows = fail_rows or set()
    hdr_bg = CRITICAL_RED if danger_header else DARK_NAVY

    head = [p(h, "th") for h in headers]
    body = []
    for i, row in enumerate(rows):
        s = "td_fail" if i in fail_rows else "td"
        body.append([p(str(c) if c is not None else "—", s) for c in row])

    cmds = [
        ("BACKGROUND",   (0,0),(-1,0), hdr_bg),
        ("TEXTCOLOR",    (0,0),(-1,0), WHITE),
        ("GRID",         (0,0),(-1,-1),0.3, MED_GRAY),
        ("LEFTPADDING",  (0,0),(-1,-1),6),
        ("RIGHTPADDING", (0,0),(-1,-1),6),
        ("TOPPADDING",   (0,0),(-1,-1),5),
        ("BOTTOMPADDING",(0,0),(-1,-1),5),
        ("VALIGN",       (0,0),(-1,-1),"TOP"),
        ("FONTSIZE",     (0,1),(-1,-1),7.5 if small else 8),
    ]
    for i in range(len(rows)):
        bg = DANGER_DEEP if i in fail_rows else (WHITE if i%2==0 else LIGHT_GRAY)
        cmds.append(("BACKGROUND",(0,i+1),(-1,i+1), bg))

    t = Table([head]+body, colWidths=col_widths, repeatRows=1)
    t.setStyle(TableStyle(cmds))
    return t


# ── CRITICAL WARNING PAGE ──────────────────────────────────────────────────────
def critical_warning_page(story, failed_items, case_number):
    usable = PAGE_W - 2 * MARGIN

    # Dark-red header block
    hdr = Table([
        [p("CRITICAL — EVIDENCE INTEGRITY FAILURE", "critical")],
        [p(f"Case: {case_number}", "critical_sub")],
        [sp(4)],
        [p(
            f"{len(failed_items)} evidence file(s) have SHA-256 hashes that do NOT "
            "match the values recorded at upload. This indicates potential tampering, "
            "corruption, or accidental modification. Full hash comparisons are shown "
            "below and in Section 3.",
            "critical_sub"
        )],
    ], colWidths=[usable])
    hdr.setStyle(TableStyle([
        ("BACKGROUND",    (0,0),(-1,-1), CRITICAL_BG),
        ("LEFTPADDING",   (0,0),(-1,-1), 24),
        ("RIGHTPADDING",  (0,0),(-1,-1), 24),
        ("TOPPADDING",    (0,0),(0,0),   30),
        ("TOPPADDING",    (0,1),(-1,-1), 6),
        ("BOTTOMPADDING", (0,-1),(-1,-1),30),
        ("BOTTOMPADDING", (0,0),(-1,-2), 6),
    ]))
    story.append(hdr)
    story.append(sp(14))
    story.append(ColorBar(DANGER, 5))
    story.append(sp(18))

    story.append(p(f"AFFECTED ITEMS — {len(failed_items)} ITEM(S) FAILED", "fail_lg"))
    story.append(sp(6))

    for idx, item in enumerate(failed_items, 1):
        stored   = item.get("stored_hash",   "") or ""
        computed = item.get("computed_hash", "") or ""
        s_marked, c_marked = _diff_hashes(stored, computed)

        rows = [[p(f"Item {idx}:  {item.get('evidence_name','—')}", "fail_lg")]]

        if not item.get("file_exists"):
            rows.append([p(
                "FILE NOT FOUND ON DISK — the evidence file is completely missing. "
                "It may have been deleted or moved.", "fail"
            )])
        elif not computed:
            rows.append([p("Could not compute hash — file may be unreadable.", "fail")])
        else:
            rows += [
                [sp(4)],
                [p("Stored hash  (recorded at upload — this is the EXPECTED value):", "hash_label")],
                [p(s_marked, "mono_pass")],
                [sp(2)],
                [p("Computed hash  (re-hashed now at report generation — this is the ACTUAL value):", "hash_label")],
                [p(c_marked, "mono_fail")],
                [sp(6)],
                [p(
                    "Upper-case characters show the exact positions where the two hashes "
                    "differ.  Even a single changed character proves the file has been modified.",
                    "note"
                )],
                [sp(4)],
                [p(
                    "CONCLUSION: Hashes do NOT match.  This file has changed since upload.  "
                    "Its integrity CANNOT be confirmed for forensic or legal purposes.",
                    "fail"
                )],
            ]

        box = Table(rows, colWidths=[usable])
        box.setStyle(TableStyle([
            ("BACKGROUND",    (0,0),(-1,-1), DANGER_BG),
            ("BOX",           (0,0),(-1,-1), 2,   DANGER),
            ("LEFTPADDING",   (0,0),(-1,-1), 18),
            ("RIGHTPADDING",  (0,0),(-1,-1), 18),
            ("TOPPADDING",    (0,0),(0,0),   14),
            ("TOPPADDING",    (0,1),(-1,-1), 4),
            ("BOTTOMPADDING", (0,-1),(-1,-1),16),
            ("BOTTOMPADDING", (0,0),(-1,-2), 4),
        ]))
        story.append(box)
        story.append(sp(12))

    story.append(ColorBar(DANGER, 3))
    story.append(sp(12))

    # Explanatory guidance table
    guidance = [
        ("What a SHA-256 hash is",
         "A unique 64-character fingerprint computed from every byte of a file.  "
         "Any change — even one bit — produces a completely different hash."),
        ("What a mismatch means",
         "The file on disk is not identical to the file that was originally uploaded.  "
         "It has been altered in some way since it was collected as evidence."),
        ("Possible causes",
         "Deliberate tampering;  accidental overwrite or re-save;  storage corruption;  "
         "file system error;  or the file being processed by an application that "
         "changed its bytes."),
        ("Recommended action",
         "Do NOT use affected evidence in legal proceedings until the cause is "
         "investigated.  Document the discrepancy in the chain of custody.  "
         "If an original write-protected copy exists, compare its hash."),
        ("Legal implications",
         "Evidence with a broken integrity chain may be inadmissible in court and "
         "will be challenged by opposing counsel.  Consult your legal team before "
         "submitting this report."),
    ]
    story.append(kv_table(guidance))
    story.append(PageBreak())


# ── Cover Page ─────────────────────────────────────────────────────────────────
def cover_page(story, case, report_meta, failed_items):
    usable   = PAGE_W - 2 * MARGIN
    has_fail = bool(failed_items)

    inner = [
        [p("DFIR CASE REPORT", "title")],
        [p(f"Case: {case.get('case_name','Unknown')}", "subtitle")],
        [sp(4)],
        [p(f"Case Number: {case.get('case_number','—')}", "cover_meta")],
        [p(f"Status: {case.get('status','—').upper()}", "cover_meta")],
        [p(f"Priority: {case.get('priority','—').upper()}", "cover_meta")],
        [p(f"Report Generated: {report_meta.get('generated_at','—')}", "cover_meta")],
        [p(f"Generated By: {report_meta.get('generated_by','—')}", "cover_meta")],
    ]
    if has_fail:
        inner += [
            [sp(8)],
            [p(f"WARNING — {len(failed_items)} EVIDENCE ITEM(S) FAILED INTEGRITY CHECK",
               "cover_crit")],
        ]

    cover = Table(inner, colWidths=[usable])
    cover.setStyle(TableStyle([
        ("BACKGROUND",    (0,0),(-1,-1), DARK_NAVY),
        ("LEFTPADDING",   (0,0),(-1,-1), 22),
        ("RIGHTPADDING",  (0,0),(-1,-1), 22),
        ("TOPPADDING",    (0,0),(0,0),   24),
        ("BOTTOMPADDING", (0,-1),(-1,-1),24),
        ("TOPPADDING",    (0,1),(-1,-1), 0),
        ("BOTTOMPADDING", (0,0),(-1,-2), 0),
    ]))
    story.append(cover)
    story.append(sp(16))
    story.append(ColorBar(DANGER if has_fail else ACCENT_BLUE, 5))
    story.append(sp(20))

    # Red alert box on the cover itself
    if has_fail:
        names = ", ".join(i.get("evidence_name","?") for i in failed_items)
        alert = Table([[p(
            f"INTEGRITY FAILURE — {len(failed_items)} item(s) failed SHA-256 verification: "
            f"{names}.  See the Critical Warning page and Section 3 for full details.",
            "fail"
        )]], colWidths=[usable])
        alert.setStyle(TableStyle([
            ("BACKGROUND",    (0,0),(-1,-1), DANGER_BG),
            ("BOX",           (0,0),(-1,-1), 2, DANGER),
            ("LEFTPADDING",   (0,0),(-1,-1), 14),
            ("TOPPADDING",    (0,0),(-1,-1), 10),
            ("BOTTOMPADDING", (0,0),(-1,-1), 10),
        ]))
        story.append(alert)
        story.append(sp(12))

    # Confidential notice
    notice = Table([[p("CONFIDENTIAL — FOR AUTHORISED RECIPIENTS ONLY", "warn")]],
                   colWidths=[usable])
    notice.setStyle(TableStyle([
        ("BACKGROUND",    (0,0),(-1,-1), WARN_BG),
        ("BOX",           (0,0),(-1,-1), 1, WARNING),
        ("LEFTPADDING",   (0,0),(-1,-1), 12),
        ("TOPPADDING",    (0,0),(-1,-1), 8),
        ("BOTTOMPADDING", (0,0),(-1,-1), 8),
    ]))
    story.append(notice)
    story.append(sp(20))

    # Summary grid
    story.append(SectionHeader("Report Summary", danger=has_fail))
    story.append(sp(8))

    fail_names = (", ".join(i.get("evidence_name","?") for i in failed_items)
                  if has_fail else None)
    rows = [
        ("Case Name",        case.get("case_name","—")),
        ("Case Number",      case.get("case_number","—")),
        ("Status",           case.get("status","—").upper()),
        ("Priority",         case.get("priority","—").upper()),
        ("Lead Investigator",report_meta.get("generated_by","—")),
        ("Client",           case.get("client_name","—")),
        ("Case Created",     fmt_date(case.get("created_at"))),
        ("Report Generated", report_meta.get("generated_at","—")),
        ("Evidence Items",   str(report_meta.get("evidence_count",0))),
        ("Evidence Integrity",
         (f"CRITICAL — {len(failed_items)} ITEM(S) FAILED: {fail_names}")
         if has_fail else
         "ALL HASHES VERIFIED — INTEGRITY CONFIRMED"),
    ]
    story.append(kv_table(rows, danger_last=has_fail))
    story.append(PageBreak())


# ── Table of Contents ──────────────────────────────────────────────────────────
def toc_page(story, sections, failed_items):
    story.append(SectionHeader("Table of Contents"))
    story.append(sp(10))
    usable = PAGE_W - 2 * MARGIN

    if failed_items:
        warn = Table([[p(
            f"This report contains an integrity failure for {len(failed_items)} "
            "evidence item(s). See the Critical Warning page and Section 3.",
            "fail"
        )]], colWidths=[usable])
        warn.setStyle(TableStyle([
            ("BACKGROUND",   (0,0),(-1,-1), DANGER_BG),
            ("BOX",          (0,0),(-1,-1), 1.5, DANGER),
            ("LEFTPADDING",  (0,0),(-1,-1), 12),
            ("TOPPADDING",   (0,0),(-1,-1), 8),
            ("BOTTOMPADDING",(0,0),(-1,-1), 8),
        ]))
        story.append(warn)
        story.append(sp(10))

    EVIDENCE_IDX = 2  # 0-based: "Evidence Log" is section 3
    rows = []
    for i, title in enumerate(sections, 1):
        is_red = bool(failed_items) and (i-1) == EVIDENCE_IDX
        suffix = "  — INTEGRITY FAILURE" if is_red else ""
        rows.append([
            p(f"{i}.", "toc_warn" if is_red else "toc_title"),
            p(title + suffix, "toc_warn" if is_red else "toc_entry"),
        ])

    toc = Table(rows, colWidths=[usable*0.08, usable*0.92])
    toc.setStyle(TableStyle([
        ("VALIGN",        (0,0),(-1,-1),"TOP"),
        ("ROWBACKGROUNDS",(0,0),(-1,-1),[WHITE, LIGHT_GRAY]),
        ("LEFTPADDING",   (0,0),(-1,-1),10),
        ("TOPPADDING",    (0,0),(-1,-1),7),
        ("BOTTOMPADDING", (0,0),(-1,-1),7),
    ]))
    story.append(toc)
    story.append(PageBreak())


# ── Section 1: Overview ────────────────────────────────────────────────────────
def section_overview(story, case, overview_text):
    story.append(SectionHeader("1. Case Overview"))
    story.append(sp(10))
    rows = [
        ("Case Name",         case.get("case_name","—")),
        ("Case Number",       case.get("case_number","—")),
        ("Status",            case.get("status","—").upper()),
        ("Priority",          case.get("priority","—").upper()),
        ("Created",           fmt_date(case.get("created_at"))),
        ("Lead Investigator", (case.get("lead_investigator",{}) or {}).get("name","—")
                               if isinstance(case.get("lead_investigator"),dict)
                               else na(case.get("lead_investigator"))),
        ("Client",            (case.get("client",{}) or {}).get("name","—")
                               if isinstance(case.get("client"),dict)
                               else na(case.get("client"))),
    ]
    story.append(kv_table(rows))
    story.append(sp(12))
    story.append(p("Case Description / Background", "label"))
    story.append(sp(4))
    story.append(p(overview_text or "No overview provided.", "body_j"))
    story.append(PageBreak())


# ── Section 2: Team ────────────────────────────────────────────────────────────
def section_team(story, case):
    story.append(SectionHeader("2. Investigation Team"))
    story.append(sp(10))
    lead   = case.get("lead_investigator")
    client = case.get("client")
    rows   = [
        ("Lead Investigator", (lead or {}).get("name","—") if isinstance(lead,dict) else na(lead)),
        ("Client / Requestor",(client or {}).get("name","—") if isinstance(client,dict) else na(client)),
    ]
    for inv in case.get("investigators",[]):
        rows.append(("Investigator",
                     (inv or {}).get("name","—") if isinstance(inv,dict) else na(inv)))
    story.append(kv_table(rows))
    story.append(PageBreak())


# ── Section 3: Evidence Log ────────────────────────────────────────────────────
def section_evidence(story, evidence_list, integrity_results):
    has_fail     = any(not r.get("match") for r in integrity_results)
    failed_items = [r for r in integrity_results if not r.get("match")]
    usable       = PAGE_W - 2 * MARGIN

    story.append(SectionHeader("3. Evidence Log & Integrity Verification",
                               danger=has_fail))
    story.append(sp(10))

    if not evidence_list:
        story.append(p("No evidence items were uploaded to this case.", "note"))
        story.append(PageBreak())
        return

    # ── Top-level banner ────────────────────────────────────────────────────────
    if has_fail:
        names_list = "\n".join(f"  •  {i.get('evidence_name','?')}" for i in failed_items)
        banner_rows = [
            [p("EVIDENCE INTEGRITY FAILURE", "fail_lg")],
            [p(f"{len(failed_items)} of {len(integrity_results)} item(s) failed "
               "SHA-256 verification.", "fail")],
            [sp(4)],
            [p("Affected items:", "label")],
            [p(names_list, "fail")],
            [sp(4)],
            [p("These files have been modified since they were uploaded.  "
               "Hash comparisons with the exact differing characters are shown "
               "in sub-section 3b below.", "body")],
        ]
        banner = Table(banner_rows, colWidths=[usable])
        banner.setStyle(TableStyle([
            ("BACKGROUND",    (0,0),(-1,-1), DANGER_BG),
            ("BOX",           (0,0),(-1,-1), 2.5, DANGER),
            ("LEFTPADDING",   (0,0),(-1,-1), 18),
            ("RIGHTPADDING",  (0,0),(-1,-1), 18),
            ("TOPPADDING",    (0,0),(0,0),   16),
            ("TOPPADDING",    (0,1),(-1,-1), 4),
            ("BOTTOMPADDING", (0,-1),(-1,-1),16),
            ("BOTTOMPADDING", (0,0),(-1,-2), 4),
        ]))
    else:
        banner = Table([
            [p("ALL EVIDENCE INTEGRITY CHECKS PASSED", "ok_lg")],
            [p(f"All {len(integrity_results)} item(s) were re-hashed at report "
               "generation and every SHA-256 value matched the value recorded at "
               "upload.  No tampering or corruption was detected.", "body")],
        ], colWidths=[usable])
        banner.setStyle(TableStyle([
            ("BACKGROUND",    (0,0),(-1,-1), SUCCESS_BG),
            ("BOX",           (0,0),(-1,-1), 1.5, SUCCESS_BRD),
            ("LEFTPADDING",   (0,0),(-1,-1), 18),
            ("TOPPADDING",    (0,0),(0,0),   14),
            ("TOPPADDING",    (0,1),(-1,-1), 4),
            ("BOTTOMPADDING", (0,-1),(-1,-1),14),
            ("BOTTOMPADDING", (0,0),(-1,-2), 4),
        ]))

    story.append(banner)
    story.append(sp(14))

    # ── 3a: Summary integrity table ─────────────────────────────────────────────
    story.append(p("3a — Integrity Check Summary", "label"))
    story.append(sp(4))

    hmap = {str(r.get("evidence_id")): r for r in integrity_results}
    headers = ["#","Evidence Name","Type","Size","Collected",
               "Stored Hash (SHA-256, first 32 chars)","Result"]
    cw = [usable*0.04, usable*0.19, usable*0.07, usable*0.07,
          usable*0.11, usable*0.40, usable*0.12]

    rows      = []
    fail_rows = set()
    for i, ev in enumerate(evidence_list):
        eid    = str(ev.get("evidence_id",""))
        res    = hmap.get(eid, {})
        match  = res.get("match")
        if match is False:
            fail_rows.add(i)
        stored = ev.get("file_hash","")
        short  = (stored[:32]+"…") if len(stored) > 32 else stored
        result = ("PASS" if match is True else "FAIL" if match is False else "N/A")
        rows.append([
            str(i+1), ev.get("evidence_name","—"),
            ev.get("file_type","—"), _fmt_size(ev.get("file_size")),
            fmt_date(ev.get("collected_at"))[:11],
            short or "—", result,
        ])

    story.append(data_table(headers, rows, col_widths=cw, small=True,
                            danger_header=has_fail, fail_rows=fail_rows))
    story.append(sp(16))

    # ── 3b: Hash diff tables (only for failed items) ─────────────────────────
    if has_fail:
        story.append(p("3b — Side-by-Side Hash Comparison for Failed Items", "label"))
        story.append(sp(6))

        for idx, item in enumerate(failed_items, 1):
            stored   = item.get("stored_hash",   "") or ""
            computed = item.get("computed_hash", "") or ""
            s_marked, c_marked = _diff_hashes(stored, computed)

            if not item.get("file_exists"):
                diff_rows = [
                    [p(f"Item {idx}: {item.get('evidence_name','—')}", "fail_lg")],
                    [p("FILE NOT FOUND ON DISK — file is missing entirely.  "
                       "It may have been deleted or moved.", "fail")],
                ]
            else:
                diff_rows = [
                    [p(f"Item {idx}: {item.get('evidence_name','—')}", "fail_lg")],
                    [sp(6)],
                    [p("STORED hash — recorded at time of upload (EXPECTED value):",
                       "hash_label")],
                    [p(s_marked if s_marked else "—", "mono_pass")],
                    [sp(4)],
                    [p("COMPUTED hash — re-hashed at report generation (ACTUAL value):",
                       "hash_label")],
                    [p(c_marked if c_marked else "—", "mono_fail")],
                    [sp(8)],
                    [p("Upper-case characters mark the exact byte positions where the "
                       "two hashes differ.  Any difference, however small, proves the "
                       "file has been modified since it was uploaded.", "note")],
                    [sp(6)],
                    [p("CONCLUSION: Hashes do NOT match.  "
                       "This evidence file has been altered.  "
                       "Its integrity CANNOT be confirmed.", "fail")],
                ]

            box = Table(diff_rows, colWidths=[usable])
            box.setStyle(TableStyle([
                ("BACKGROUND",    (0,0),(-1,-1), DANGER_BG),
                ("BOX",           (0,0),(-1,-1), 2, DANGER),
                ("LEFTPADDING",   (0,0),(-1,-1), 18),
                ("RIGHTPADDING",  (0,0),(-1,-1), 18),
                ("TOPPADDING",    (0,0),(0,0),   14),
                ("TOPPADDING",    (0,1),(-1,-1), 4),
                ("BOTTOMPADDING", (0,-1),(-1,-1),16),
                ("BOTTOMPADDING", (0,0),(-1,-2), 4),
            ]))
            story.append(KeepTogether([box, sp(12)]))

        story.append(sp(4))

    # ── 3c: Detailed evidence records ─────────────────────────────────────────
    story.append(p("3c — Detailed Evidence Records", "label"))
    story.append(sp(6))

    for i, ev in enumerate(evidence_list, 1):
        eid   = str(ev.get("evidence_id",""))
        res   = hmap.get(eid, {})
        match = res.get("match")

        status_text = (
            "VERIFIED — SHA-256 MATCH — File unchanged since upload"
            if match is True else
            "FAILED — SHA-256 MISMATCH — File has been altered since upload"
            if match is False else "Not verified"
        )

        detail_rows = [
            ("Evidence Name",   ev.get("evidence_name","—")),
            ("Description",     ev.get("description","—")),
            ("File Type",       ev.get("file_type","—")),
            ("File Size",       _fmt_size(ev.get("file_size"))),
            ("Date Collected",  fmt_date(ev.get("collected_at"))),
            ("SHA-256 Hash",    ev.get("file_hash","—")),
            ("Integrity Status", status_text),
        ]
        for key, label in [("make","Camera Make"),("model","Camera Model"),
                            ("datetime_original","Date Taken"),("software","Software"),
                            ("exposure_time","Exposure"),("f_number","F-Number"),
                            ("iso","ISO"),("focal_length","Focal Length")]:
            val = ev.get(key)
            if val:
                detail_rows.append((label, na(val)))

        hdr_bg  = SUCCESS_BG   if match is True  else DANGER_BG   if match is False else LIGHT_GRAY
        hdr_brd = SUCCESS_BRD  if match is True  else DANGER      if match is False else MED_GRAY
        suffix  = " — VERIFIED" if match is True else " — INTEGRITY FAILURE" if match is False else ""
        hdr_sty = "ok"          if match is True else "fail"        if match is False else "label"

        hdr = Table([[p(f"Evidence Item {i}: {ev.get('evidence_name','—')}{suffix}", hdr_sty)]],
                    colWidths=[usable])
        hdr.setStyle(TableStyle([
            ("BACKGROUND",    (0,0),(-1,-1), hdr_bg),
            ("BOX",           (0,0),(-1,-1), 1.5, hdr_brd),
            ("LEFTPADDING",   (0,0),(-1,-1), 12),
            ("TOPPADDING",    (0,0),(-1,-1), 9),
            ("BOTTOMPADDING", (0,0),(-1,-1), 9),
        ]))

        # KV table — integrity row highlighted
        w = [usable*0.32, usable*0.68]
        kv_data = [[p(k,"label"), p(v,"value")] for k,v in detail_rows]
        kv_t = Table(kv_data, colWidths=w)
        INTEGRITY_ROW = 6
        cmds = [
            ("VALIGN",        (0,0),(-1,-1),"TOP"),
            ("ROWBACKGROUNDS",(0,0),(-1,-1),[WHITE, LIGHT_GRAY]),
            ("LEFTPADDING",   (0,0),(-1,-1),8),
            ("RIGHTPADDING",  (0,0),(-1,-1),8),
            ("TOPPADDING",    (0,0),(-1,-1),5),
            ("BOTTOMPADDING", (0,0),(-1,-1),5),
            ("LINEBELOW",     (0,0),(-1,-2),0.3,MED_GRAY),
        ]
        if match is False:
            cmds += [
                ("BACKGROUND",(0,INTEGRITY_ROW),(-1,INTEGRITY_ROW), DANGER_DEEP),
                ("TEXTCOLOR", (1,INTEGRITY_ROW),(1,INTEGRITY_ROW),  DANGER),
                ("FONTNAME",  (1,INTEGRITY_ROW),(1,INTEGRITY_ROW),  "Helvetica-Bold"),
            ]
        elif match is True:
            cmds += [
                ("BACKGROUND",(0,INTEGRITY_ROW),(-1,INTEGRITY_ROW), SUCCESS_BG),
                ("TEXTCOLOR", (1,INTEGRITY_ROW),(1,INTEGRITY_ROW),  SUCCESS),
                ("FONTNAME",  (1,INTEGRITY_ROW),(1,INTEGRITY_ROW),  "Helvetica-Bold"),
            ]
        kv_t.setStyle(TableStyle(cmds))
        story.append(KeepTogether([hdr, sp(2), kv_t, sp(10)]))

    story.append(PageBreak())


# ── Section 4: Findings ────────────────────────────────────────────────────────
def section_findings(story, findings, recommendations):
    story.append(SectionHeader("4. Findings & Recommendations"))
    story.append(sp(10))
    story.append(p("Investigation Findings", "label"))
    story.append(sp(4))
    story.append(p(findings or "No findings documented.", "body_j"))
    story.append(sp(12))
    story.append(p("Recommendations", "label"))
    story.append(sp(4))
    story.append(p(recommendations or "No recommendations provided.", "body_j"))
    story.append(PageBreak())


# ── Section 5: Tools ───────────────────────────────────────────────────────────
def section_tools(story, tools):
    story.append(SectionHeader("5. Tools Used"))
    story.append(sp(10))
    if not tools:
        story.append(p("No forensic tools recorded.", "note"))
        story.append(PageBreak())
        return
    usable = PAGE_W - 2 * MARGIN
    cw = [usable*0.25, usable*0.15, usable*0.45, usable*0.15]
    rows = [[t.get("tool_name","—"), na(t.get("tool_version")),
             na(t.get("purpose")), fmt_date(t.get("created_at"))[:11]] for t in tools]
    story.append(data_table(["Tool Name","Version","Purpose","Added"],
                            rows, col_widths=cw))
    story.append(PageBreak())


# ── Section 6: Chain of Custody ───────────────────────────────────────────────
def section_coc(story, coc_records):
    story.append(SectionHeader("6. Chain of Custody"))
    story.append(sp(10))
    story.append(p("All custody events recorded per NIST SP 800-86.", "body_j"))
    story.append(sp(10))
    if not coc_records:
        story.append(p("No chain of custody events recorded.", "note"))
        story.append(PageBreak())
        return
    usable = PAGE_W - 2 * MARGIN
    cw = [usable*0.04, usable*0.13, usable*0.16, usable*0.13,
          usable*0.24, usable*0.14, usable*0.16]
    rows = [[str(i), r.get("event_type","—").replace("_"," "),
             na(r.get("evidence_name")), fmt_date(r.get("event_datetime"))[:16],
             na(r.get("reason")), na(r.get("location")), na(r.get("created_by_name"))]
            for i, r in enumerate(coc_records, 1)]
    story.append(data_table(["#","Event Type","Evidence","Date/Time",
                              "Reason","Location","Recorded By"],
                            rows, col_widths=cw, small=True))
    story.append(sp(10))
    for rec in [r for r in coc_records if r.get("event_type")=="TRANSFERRED"]:
        t_rows = [
            ("Evidence", na(rec.get("evidence_name"))),
            ("Date/Time", fmt_date(rec.get("event_datetime"))),
            ("Released By", na(rec.get("released_by_name"))),
            ("Releasing Role", na(rec.get("released_by_role"))),
            ("Received By", na(rec.get("received_by_name"))),
            ("Receiving Role", na(rec.get("received_by_role"))),
            ("Reason", na(rec.get("reason"))),
            ("Notes", na(rec.get("notes"))),
        ]
        story.append(KeepTogether([kv_table(t_rows), sp(6)]))
    story.append(PageBreak())


# ── Section 7: Audit Log ───────────────────────────────────────────────────────
def section_audit(story, audit_log):
    story.append(SectionHeader("7. System Audit Log"))
    story.append(sp(10))
    story.append(p("Cryptographically chained record of all system events.", "body_j"))
    story.append(sp(10))
    if not audit_log:
        story.append(p("No audit log entries.", "note"))
        story.append(PageBreak())
        return
    usable = PAGE_W - 2 * MARGIN
    cw = [usable*0.04, usable*0.15, usable*0.14, usable*0.12,
          usable*0.40, usable*0.15]
    rows = []
    for i, e in enumerate(audit_log, 1):
        h = e.get("hash","") or e.get("event_hash","")
        rows.append([str(i), fmt_date(e.get("timestamp"))[:16],
                     e.get("action","—").replace("_"," "),
                     na(e.get("user")), na(e.get("details")),
                     (h[:16]+"…") if len(h)>16 else h])
    story.append(data_table(["#","Timestamp","Action","User","Details","Hash (first 16)"],
                            rows, col_widths=cw, small=True))
    story.append(PageBreak())


# ── Section 8: Sign-Off ────────────────────────────────────────────────────────
def section_signoff(story, report_meta, failed_items):
    has_fail = bool(failed_items)
    story.append(SectionHeader("8. Sign-Off & Certification", danger=has_fail))
    story.append(sp(10))

    if has_fail:
        rows = [
            [p("INTEGRITY FAILURE — REPORT CANNOT BE FULLY CERTIFIED", "fail_lg")],
            [sp(4)],
            [p(f"This report cannot be issued with a clean integrity certification because "
               f"{len(failed_items)} evidence item(s) failed SHA-256 verification:", "fail")],
        ]
        for item in failed_items:
            rows.append([p(f"  •  {item.get('evidence_name','?')}", "fail")])
        rows += [
            [sp(4)],
            [p("Resolve the integrity issues before using this report in legal or "
               "regulatory proceedings.  See Section 3 for full hash details.", "body")],
        ]
        warn = Table(rows, colWidths=[PAGE_W - 2*MARGIN])
        warn.setStyle(TableStyle([
            ("BACKGROUND",    (0,0),(-1,-1), DANGER_BG),
            ("BOX",           (0,0),(-1,-1), 2, DANGER),
            ("LEFTPADDING",   (0,0),(-1,-1), 18),
            ("RIGHTPADDING",  (0,0),(-1,-1), 18),
            ("TOPPADDING",    (0,0),(0,0),   16),
            ("TOPPADDING",    (0,1),(-1,-1), 4),
            ("BOTTOMPADDING", (0,-1),(-1,-1),16),
            ("BOTTOMPADDING", (0,0),(-1,-2), 4),
        ]))
        story.append(warn)
        story.append(sp(16))

    for line in [
        f"This report for case <b>{report_meta.get('case_number','—')}</b> was generated "
        f"by <b>{report_meta.get('generated_by','—')}</b> on "
        f"<b>{report_meta.get('generated_at','—')}</b>.",
        "",
        "The lead investigator certifies that:",
        "•  Evidence was handled in accordance with NIST SP 800-86.",
        f"•  SHA-256 integrity check performed at report generation.",
        f"•  Integrity: {'ONE OR MORE ITEMS FAILED — see Section 3.' if has_fail else 'ALL HASHES VERIFIED — no tampering detected.'}",
        "•  Audit log is a complete record of all case activity.",
        "•  Chain of custody records all evidence handling events.",
    ]:
        if line == "":
            story.append(sp(6))
        else:
            sty = "fail" if has_fail and "FAILED" in line else "body"
            story.append(p(line, sty))

    story.append(sp(20))
    story.append(hr(DANGER if has_fail else DARK_NAVY, 1.5))
    story.append(sp(40))

    usable = PAGE_W - 2 * MARGIN
    sig_label = "Lead Investigator Signature" + (" (CONDITIONAL — integrity unresolved)" if has_fail else "")
    sig = Table([
        [p(sig_label, "label"), p("Date", "label")],
        [p("_"*42, "value"),    p("_"*22, "value")],
    ], colWidths=[usable*0.65, usable*0.35])
    sig.setStyle(TableStyle([
        ("VALIGN",     (0,0),(-1,-1),"BOTTOM"),
        ("LEFTPADDING",(0,0),(-1,-1),0),
        ("TOPPADDING", (0,0),(-1,-1),0),
    ]))
    story.append(sig)
    story.append(sp(12))
    story.append(p("Auto-generated by DFIR Case Management System.", "note"))


# ── Master builder ─────────────────────────────────────────────────────────────
def build_report(data: dict, output_path: str):
    case          = data.get("case", {})
    overview_text = data.get("overview", "")
    findings      = data.get("findings", {})
    tools         = data.get("tools", [])
    coc_records   = data.get("coc_records", [])
    audit_log     = data.get("audit_log", [])
    evidence_list = data.get("evidence", [])
    integrity     = data.get("integrity_results", [])
    report_meta   = data.get("report_meta", {})

    report_meta.setdefault("generated_at",
                           datetime.now().strftime("%d %b %Y  %H:%M:%S UTC"))
    report_meta["case_number"]      = case.get("case_number","—")
    report_meta["evidence_count"]   = len(evidence_list)
    report_meta["all_hashes_match"] = bool(integrity and all(r.get("match") for r in integrity))

    failed_items = [r for r in integrity if not r.get("match")]
    has_fail     = bool(failed_items)

    doc = SimpleDocTemplate(
        output_path,
        pagesize=A4,
        topMargin=MARGIN + 18*mm,
        bottomMargin=MARGIN + 12*mm,
        leftMargin=MARGIN,
        rightMargin=MARGIN,
        title=f"DFIR Report — {case.get('case_number','')}",
        author="DFIR Case Management System",
        subject="Digital Forensics Investigation Report",
    )

    story = []
    cover_page(story, case, report_meta, failed_items)

    if has_fail:
        critical_warning_page(story, failed_items, case.get("case_number","—"))

    toc_page(story, [
        "Case Overview",
        "Investigation Team",
        "Evidence Log & Integrity Verification",
        "Findings & Recommendations",
        "Forensic Tools Used",
        "Chain of Custody",
        "System Audit Log",
        "Sign-Off & Certification",
    ], failed_items)

    section_overview(story, case, overview_text)
    section_team(story, case)
    section_evidence(story, evidence_list, integrity)
    section_findings(story, findings.get("findings",""), findings.get("recommendations",""))
    section_tools(story, tools)
    section_coc(story, coc_records)
    section_audit(story, audit_log)
    section_signoff(story, report_meta, failed_items)

    def make_canvas(*args, **kwargs):
        return PageNumCanvas(
            *args,
            case_number=case.get("case_number",""),
            report_date=report_meta.get("generated_at",""),
            integrity_failed=has_fail,
            **kwargs,
        )

    doc.build(story, canvasmaker=make_canvas)
    return output_path


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--input",  "-i", default="-")
    parser.add_argument("--output", "-o", required=True)
    args = parser.parse_args()
    raw  = sys.stdin.read() if args.input == "-" else open(args.input).read()
    out  = build_report(json.loads(raw), args.output)
    print(f"Report generated: {out}", file=sys.stderr)