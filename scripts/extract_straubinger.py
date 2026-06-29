"""
Extracts the "Sagrada Biblia - Mons. Juan Straubinger" from its PDF into
structured per-verse JSON, plus the translator's footnotes as a separate
doctrinal index.

The PDF encodes typography we exploit to separate the three text streams that
are visually interleaved on each page:

  - Scripture body  -> font MaiandraGD-Regular, size ~18  (the only text cited)
  - Verse numbers   -> size ~11 numerals (superscript in OT, inline in NT)
  - Footnotes        -> size ~12 body, with a size 8 (OT) or size 7 (NT) marker
  - Pericope titles  -> Cambria-Italic size ~18 (OT) / small-caps ~14.5 (NT)
  - Book/chapter headers -> size >= 22

Book names in the body already use the MODERN scheme (e.g. "1 Samuel",
"Génesis"); Psalms carry dual numbering "Salmo 22 (23)" — we keep the modern
number in parentheses so the rest of the app (daily verses, references) stays
consistent.

Output:
  data/biblia.json            — [{libro, abbr, capitulo, versiculo, texto}]
  data/straubinger-notes.json — [{id, ref, libro, abbr, capitulo, versiculo, texto}]
"""

from __future__ import annotations

import io
import json
import re
import sys
import unicodedata
from pathlib import Path

import fitz  # PyMuPDF

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

ROOT = Path(__file__).resolve().parent.parent
PDF = ROOT / "Contexto" / "Biblia.pdf"  # Sagrada Biblia — Mons. Straubinger
OUT_VERSES = ROOT / "data" / "biblia.json"
OUT_NOTES = ROOT / "data" / "straubinger-notes.json"

# (canonical_name, abbr, expected_chapters, kind)  kind: standard | salmos
BOOKS = [
    ("Génesis", "Gén", 50), ("Éxodo", "Éx", 40), ("Levítico", "Lev", 27),
    ("Números", "Núm", 36), ("Deuteronomio", "Dt", 34), ("Josué", "Jos", 24),
    ("Jueces", "Jue", 21), ("Rut", "Rut", 4), ("1 Samuel", "1 Sam", 31),
    ("2 Samuel", "2 Sam", 24), ("1 Reyes", "1 Re", 22), ("2 Reyes", "2 Re", 25),
    ("1 Crónicas", "1 Crón", 29), ("2 Crónicas", "2 Crón", 36),
    ("Esdras", "Esd", 10), ("Nehemías", "Neh", 13), ("Tobías", "Tob", 14),
    ("Judit", "Jdt", 16), ("Ester", "Est", 16), ("1 Macabeos", "1 Mac", 16),
    ("2 Macabeos", "2 Mac", 15), ("Job", "Job", 42), ("Salmos", "Sal", 150),
    ("Proverbios", "Prov", 31), ("Eclesiastés", "Ecl", 12),
    ("Cantar de los Cantares", "Cant", 8), ("Sabiduría", "Sab", 19),
    ("Eclesiástico", "Eclo", 51), ("Isaías", "Is", 66), ("Jeremías", "Jer", 52),
    ("Lamentaciones", "Lam", 5), ("Baruc", "Bar", 6), ("Ezequiel", "Ez", 48),
    ("Daniel", "Dan", 14), ("Oseas", "Os", 14), ("Joel", "Jl", 3),
    ("Amós", "Am", 9), ("Abdías", "Abd", 1), ("Jonás", "Jon", 4),
    ("Miqueas", "Miq", 7), ("Nahúm", "Nah", 3), ("Habacuc", "Hab", 3),
    ("Sofonías", "Sof", 3), ("Ageo", "Ag", 2), ("Zacarías", "Zac", 14),
    ("Malaquías", "Mal", 4),
    ("Mateo", "Mt", 28), ("Marcos", "Mc", 16), ("Lucas", "Lc", 24),
    ("Juan", "Jn", 21), ("Hechos de los Apóstoles", "Hch", 28),
    ("Romanos", "Rom", 16), ("1 Corintios", "1 Cor", 16),
    ("2 Corintios", "2 Cor", 13), ("Gálatas", "Gal", 6), ("Efesios", "Ef", 6),
    ("Filipenses", "Flp", 4), ("Colosenses", "Col", 4),
    ("1 Tesalonicenses", "1 Tes", 5), ("2 Tesalonicenses", "2 Tes", 3),
    ("1 Timoteo", "1 Tim", 6), ("2 Timoteo", "2 Tim", 4), ("Tito", "Tit", 3),
    ("Filemón", "Flm", 1), ("Hebreos", "Heb", 13), ("Santiago", "Sant", 5),
    ("1 Pedro", "1 Pe", 5), ("2 Pedro", "2 Pe", 3), ("1 Juan", "1 Jn", 5),
    ("2 Juan", "2 Jn", 1), ("3 Juan", "3 Jn", 1), ("Judas", "Jud", 1),
    ("Apocalipsis", "Ap", 22),
]

ABBR = {name: abbr for name, abbr, _ in BOOKS}
EXPECTED = {name: ch for name, _, ch in BOOKS}
SINGLE_CHAP = {name for name, _, ch in BOOKS if ch == 1}


def norm(s: str) -> str:
    """Uppercase, strip accents, collapse whitespace — for header matching."""
    s = unicodedata.normalize("NFD", s)
    s = "".join(c for c in s if unicodedata.category(c) != "Mn")
    return re.sub(r"\s+", " ", s).strip().upper()


# Header key (normalized) -> canonical book name. Covers OT title-case and NT
# all-caps chapter headers, both pointing at the same canonical name.
HEADER_TO_BOOK = {}
for name, _, _ in BOOKS:
    HEADER_TO_BOOK[norm(name)] = name
# NT all-caps / variant spellings seen in the PDF chapter headers & dividers.
HEADER_TO_BOOK.update({
    "HECHOS": "Hechos de los Apóstoles",
    "APOCALIPSIS": "Apocalipsis",
    "CANTAR": "Cantar de los Cantares",
    "NAHUM": "Nahúm",
})

# Resolve a book from an epistle/letter divider title (those headed only
# "CAPÍTULO <n>" for their first chapter). Only called on titles containing
# "CARTA", which keeps section headings like "II. Judas Macabeo" from matching.
_KEYS_PAIR = {
    "CORINTIOS": "Corintios", "TESALONICENSES": "Tesalonicenses",
    "TIMOTEO": "Timoteo", "PEDRO": "Pedro",
}
_KEYS_SIMPLE = {
    "FILIPENSES": "Filipenses", "COLOSENSES": "Colosenses", "GALATAS": "Gálatas",
    "EFESIOS": "Efesios", "ROMANOS": "Romanos", "HEBREOS": "Hebreos",
    "TITO": "Tito", "FILEMON": "Filemón",
}


def resolve_divider(nnt: str) -> str | None:
    if "JUDAS" in nnt:
        return "Judas"
    if "JUAN" in nnt:
        if "PRIMERA" in nnt:
            return "1 Juan"
        if "SEGUNDA" in nnt:
            return "2 Juan"
        if "TERCERA" in nnt:
            return "3 Juan"
        return None
    for kw, base in _KEYS_PAIR.items():
        if kw in nnt:
            if "PRIMERA" in nnt:
                return f"1 {base}"
            if "SEGUNDA" in nnt:
                return f"2 {base}"
            return None
    if "SANTIAGO" in nnt:
        return "Santiago"
    for kw, base in _KEYS_SIMPLE.items():
        if kw in nnt:
            return base
    return None

ROMAN = {
    "I": 1, "II": 2, "III": 3, "IV": 4, "V": 5, "VI": 6, "VII": 7, "VIII": 8,
    "IX": 9, "X": 10, "XI": 11, "XII": 12, "XIII": 13, "XIV": 14, "XV": 15,
    "XVI": 16, "XVII": 17, "XVIII": 18, "XIX": 19, "XX": 20, "XXI": 21,
    "XXII": 22, "XXIII": 23, "XXIV": 24, "XXV": 25, "XXVI": 26, "XXVII": 27,
    "XXVIII": 28,
}

# size buckets
def is_scripture_size(sz: float) -> bool:
    return 16.5 <= sz <= 20.0

def is_versenum_size(sz: float) -> bool:
    return 10.4 <= sz <= 11.45

def is_note_size(sz: float) -> bool:
    return 11.6 <= sz <= 13.5

def is_smallcaps_size(sz: float) -> bool:
    return 13.6 <= sz <= 15.5


OT_CHAP_RE = re.compile(r"^(.*?)\s+(\d+)\s*$")
PSALM_RE = re.compile(r"^Salmo\s+\d+\s*[ab]?\s*\((\d+)")  # modern num in parens
NT_CHAP_RE = re.compile(r"^(\d?\s*[A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑ\.\s]*?)\s+([IVXLC]+)\s*$")
CAP_RE = re.compile(r"^CAP[IÍ]TULO\s+([IVXLC]+)\s*$")


def main() -> None:
    doc = fitz.open(PDF)

    verses: list[dict] = []
    notes: list[dict] = []

    cur_book: str | None = None
    cur_chap: int = 0
    cur_verse: int = 0
    # text accumulator keyed by (book, chap, verse)
    vtext: dict[tuple, list[str]] = {}
    vorder: list[tuple] = []

    # note accumulation: per (book, chap) collect raw note-body fragments split
    # by markers; we resolve verse number from each note's leading "N." token.
    note_buf: list[str] = []   # fragments of the *current* note
    note_chap_ctx: tuple | None = None

    def flush_note():
        nonlocal note_buf
        if note_buf and note_chap_ctx:
            body = re.sub(r"\s+", " ", " ".join(note_buf)).strip()
            m = re.match(r"^(\d+)", body)
            vn = int(m.group(1)) if m else 0
            body = re.sub(r"^\d+\s*(?:s+|ss)?\.?\s*", "", body).strip()
            if len(body) >= 25:
                bk, ch = note_chap_ctx
                ab = ABBR.get(bk, bk)
                notes.append({
                    "libro": bk, "abbr": ab, "capitulo": ch,
                    "versiculo": vn, "texto": body,
                })
        note_buf = []

    def add_verse_text(t: str):
        if cur_book is None or cur_chap == 0 or cur_verse == 0:
            return
        key = (cur_book, cur_chap, cur_verse)
        if key not in vtext:
            vtext[key] = []
            vorder.append(key)
        vtext[key].append(t)

    for pno in range(len(doc)):
        page = doc[pno]
        blocks = page.get_text("dict")["blocks"]
        # reading order
        blocks = sorted(blocks, key=lambda b: (round(b["bbox"][1]), round(b["bbox"][0])))
        for b in blocks:
            for line in b.get("lines", []):
                spans = [s for s in line["spans"] if s["text"] != ""]
                if not spans:
                    continue
                line_txt = "".join(s["text"] for s in spans).strip()
                line_max = max(s["size"] for s in spans)

                # ---- Big headers (size >= ~22) --------------------------------
                if line_max >= 21.5:
                    flush_note()
                    nt = line_txt.strip()
                    # Psalm header (dual numbering)
                    pm = PSALM_RE.match(nt)
                    if nt.startswith("Salmo ") and (pm or re.match(r"^Salmo\s+\d+\s*[ab]?\s*$", nt)):
                        cur_book = "Salmos"
                        cur_chap = int(pm.group(1)) if pm else int(re.search(r"\d+", nt).group())
                        cur_verse = 0
                        note_chap_ctx = (cur_book, cur_chap)
                        continue
                    # OT "<Name> <n>"
                    om = OT_CHAP_RE.match(nt)
                    if om and norm(om.group(1)) in HEADER_TO_BOOK:
                        cur_book = HEADER_TO_BOOK[norm(om.group(1))]
                        cur_chap = int(om.group(2)); cur_verse = 0
                        note_chap_ctx = (cur_book, cur_chap)
                        continue
                    # Bare book-name title (e.g. "Abdías", "Genesis") — sets the
                    # current book; single-chapter books start at chapter 1.
                    if norm(nt) in HEADER_TO_BOOK:
                        cur_book = HEADER_TO_BOOK[norm(nt)]
                        cur_chap = 1 if cur_book in SINGLE_CHAP else 0
                        cur_verse = 0
                        note_chap_ctx = (cur_book, cur_chap) if cur_chap else None
                        continue
                    # Divider that sets current book (for CAPÍTULO chapters)
                    nnt = norm(nt)
                    if "CARTA" in nnt:
                        canon = resolve_divider(nnt)
                        if canon:
                            cur_book = canon
                            cur_chap = 1 if canon in SINGLE_CHAP else 0
                            cur_verse = 0
                            note_chap_ctx = (cur_book, cur_chap) if cur_chap else None
                            continue
                    # Unrecognized big title (Introducción, Prólogo, part-division,
                    # testament divider): stop verse accumulation so the last verse
                    # of a book doesn't absorb the next book's intro material.
                    cur_verse = 0
                    flush_note()
                    continue

                # ---- NT chapter header "<NAME> <ROMAN>" or "CAPÍTULO <ROMAN>" --
                if is_scripture_size(line_max) and len(line_txt) <= 24:
                    cm = CAP_RE.match(line_txt)
                    if cm and cur_book is not None:
                        cur_chap = ROMAN.get(cm.group(1), cur_chap); cur_verse = 0
                        note_chap_ctx = (cur_book, cur_chap)
                        flush_note(); continue
                    nm = NT_CHAP_RE.match(line_txt)
                    if nm and norm(nm.group(1)) in HEADER_TO_BOOK and nm.group(2) in ROMAN:
                        cur_book = HEADER_TO_BOOK[norm(nm.group(1))]
                        cur_chap = ROMAN[nm.group(2)]; cur_verse = 0
                        note_chap_ctx = (cur_book, cur_chap)
                        flush_note(); continue

                if line_txt == "Volver al Indice":
                    continue

                # ---- Walk spans, classifying ----------------------------------
                # Pre-mark small-caps heading runs (NT pericope titles).
                heading_idx = set()
                for i, s in enumerate(spans):
                    if is_smallcaps_size(s["size"]):
                        heading_idx.add(i)
                        # absorb adjacent size-18 single-letter/punct initials
                        for j in (i - 1, i + 1):
                            if 0 <= j < len(spans):
                                tj = spans[j]["text"].strip()
                                if is_scripture_size(spans[j]["size"]) and len(tj) <= 1:
                                    heading_idx.add(j)

                prev_char = " "  # for verse-number attach test (start of line)
                for i, s in enumerate(spans):
                    t = s["text"]
                    sz = s["size"]
                    font = s["font"]
                    stripped = t.strip()

                    if i in heading_idx:
                        if stripped:
                            prev_char = stripped[-1]
                        continue

                    # Verse number?
                    if is_versenum_size(sz) and stripped.isdigit():
                        n = int(stripped)
                        # Distinguish a verse number from a footnote-reference
                        # superscript (both size 11). A verse number is either at
                        # the line start, followed by a space (NT prose: "44 Mas"),
                        # or followed by the ∗ note glyph (OT: "1∗Al"). A note ref
                        # hugs a word or the sentence punctuation ("enemigo»51.").
                        nxt = ""
                        for s2 in spans[i + 1:]:
                            if s2["text"]:
                                nxt = s2["text"][0]
                                break
                        # A note ref hugs the sentence punctuation that follows it
                        # ("enemigo»51." → "51" then "."). A verse number is
                        # followed by a space, the ∗ glyph, a letter or an opening
                        # quote — never by closing punctuation.
                        ref_like = nxt in ".,:;)]”»!?"
                        is_marker = (
                            (not prev_char.isalnum())
                            and not ref_like
                            and n > cur_verse and (n - cur_verse) <= 12 and n <= 200
                        )
                        if is_marker:
                            flush_note()  # a new verse closes any open note context
                            cur_verse = n
                        # footnote-ref or rejected number: ignore
                        prev_char = stripped[-1] if stripped else prev_char
                        continue

                    # Scripture body?
                    if is_scripture_size(sz) and "Italic" not in font:
                        add_verse_text(t)
                        if stripped:
                            prev_char = stripped[-1]
                        continue

                    # Italic (Cambria) pericope title at scripture size -> skip
                    if is_scripture_size(sz) and "Italic" in font:
                        if stripped:
                            prev_char = stripped[-1]
                        continue

                    # Note body (size ~12)
                    if is_note_size(sz):
                        # size 8 (OT) / size 7 (NT) markers arrive as their own
                        # tiny spans; a new marker means a new note.
                        note_buf.append(t)
                        continue

                    # Tiny note markers (∗ size 8 / superscript index size 7)
                    if sz <= 9.5:
                        flush_note()
                        continue
                    # else: ignore (page numbers size ~7 handled above, blanks)

    flush_note()

    # Assemble verses in document order.
    out_verses = []
    for key in vorder:
        bk, ch, vn = key
        txt = re.sub(r"\s+", " ", " ".join(vtext[key])).strip()
        txt = txt.replace("­", "")
        # Drop the stray spaces left where footnote-reference superscripts were
        # removed (e.g. "espíritu , porque" -> "espíritu, porque").
        txt = re.sub(r"\s+([,.;:!?»”)])", r"\1", txt)
        txt = re.sub(r"([«“(¿¡])\s+", r"\1", txt)
        txt = txt.strip()
        # Skip placeholder/empty verses (bracketed textual variants, stray dots).
        if len(re.sub(r"[^0-9A-Za-zÁÉÍÓÚÑáéíóúñ]", "", txt)) < 2:
            continue
        out_verses.append({
            "libro": bk, "abbr": ABBR.get(bk, bk),
            "capitulo": ch, "versiculo": vn, "texto": txt,
        })

    for i, n in enumerate(notes):
        n["id"] = i
        ref = f"{n['abbr']} {n['capitulo']}"
        if n["versiculo"]:
            ref += f":{n['versiculo']}"
        n["ref"] = ref

    OUT_VERSES.write_text(json.dumps(out_verses, ensure_ascii=False), encoding="utf-8")
    OUT_NOTES.write_text(json.dumps(notes, ensure_ascii=False), encoding="utf-8")

    # ---- Validation summary -------------------------------------------------
    from collections import defaultdict
    chaps = defaultdict(set)
    vcount = defaultdict(int)
    for v in out_verses:
        chaps[v["libro"]].add(v["capitulo"])
        vcount[v["libro"]] += 1
    print("=== RESUMEN STRAUBINGER ===")
    problems = 0
    for name, _, exp in BOOKS:
        found = len(chaps.get(name, set()))
        flag = "OK" if found == exp else "!!"
        if found != exp:
            problems += 1
        print(f"  [{flag}] {name:28} {found:3}/{exp:3} cap  {vcount.get(name,0):5} versículos")
    print(f"\nTotal versículos: {len(out_verses)}  | libros con problemas: {problems}")
    print(f"Total notas: {len(notes)}")
    print(f"\nEscrito {OUT_VERSES}")
    print(f"Escrito {OUT_NOTES}")


if __name__ == "__main__":
    main()
