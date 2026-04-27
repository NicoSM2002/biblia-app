"""
Extracts the Catholic Bible (BAC 2011 - Conferencia Episcopal Española) from
the layout-preserved text of Biblia.pdf and outputs structured JSON.

Strategy:
  1. Split the raw text into per-book chunks using ALL-CAPS book headers.
  2. Within each book chunk, extract chapters using book-specific strategies:
       - Standard books: chapter markers like "Gén1 1 ", "1 Sam3 1 ", etc.
       - Salmos: chapter markers like "Salmo 1*" or "Salmo 23".
       - Single-chapter books (Abdías, Filemón, 2 Juan, 3 Juan, Judas): treat
         the whole book chunk as chapter 1.
  3. Within each chapter chunk, parse verses by walking monotonic verse numbers.

Output:
  data/biblia.json — list of {libro, abbr, capitulo, versiculo, texto}
"""

from __future__ import annotations

import io
import json
import re
import sys
from pathlib import Path

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

ROOT = Path(__file__).resolve().parent.parent
RAW_TXT = ROOT / "data" / "biblia-raw.txt"
OUT_JSON = ROOT / "data" / "biblia.json"


# (canonical_name, abbreviation as used in chapter markers and references,
#  all-caps header as it appears in the PDF, total chapters, kind)
# kind: "standard" | "salmos" | "single"
BOOKS = [
    # Antiguo Testamento
    ("Génesis", "Gén", "GÉNESIS", 50, "standard"),
    ("Éxodo", "Éx", "ÉXODO", 40, "standard"),
    ("Levítico", "Lev", "LEVÍTICO", 27, "standard"),
    ("Números", "Núm", "NÚMEROS", 36, "standard"),
    ("Deuteronomio", "Dt", "DEUTERONOMIO", 34, "standard"),
    ("Josué", "Jos", "JOSUÉ", 24, "standard"),
    ("Jueces", "Jue", "JUECES", 21, "standard"),
    ("Rut", "Rut", "RUT", 4, "standard"),
    ("1 Samuel", "1 Sam", "1 SAMUEL", 31, "standard"),
    ("2 Samuel", "2 Sam", "2 SAMUEL", 24, "standard"),
    ("1 Reyes", "1 Re", "1 REYES", 22, "standard"),
    ("2 Reyes", "2 Re", "2 REYES", 25, "standard"),
    ("1 Crónicas", "1 Crón", "1 CRÓNICAS", 29, "standard"),
    ("2 Crónicas", "2 Crón", "2 CRÓNICAS", 36, "standard"),
    ("Esdras", "Esd", "ESDRAS", 10, "standard"),
    ("Nehemías", "Neh", "NEHEMÍAS", 13, "standard"),
    ("Tobías", "Tob", "TOBÍAS", 14, "standard"),
    ("Judit", "Jdt", "JUDIT", 16, "standard"),
    ("Ester", "Est", "ESTER", 10, "standard"),
    ("1 Macabeos", "1 Mac", "1 MACABEOS", 16, "standard"),
    ("2 Macabeos", "2 Mac", "2 MACABEOS", 15, "standard"),
    ("Job", "Job", "JOB", 42, "standard"),
    ("Salmos", "Sal", "SALMOS", 150, "salmos"),
    ("Proverbios", "Prov", "PROVERBIOS", 31, "standard"),
    ("Eclesiastés", "Ecl", "ECLESIASTÉS", 12, "standard"),
    ("Cantar de los Cantares", "Cant", "CANTAR DE LOS CANTARES", 8, "standard"),
    ("Sabiduría", "Sab", "SABIDURÍA", 19, "standard"),
    ("Eclesiástico", "Eclo", "ECLESIÁSTICO", 51, "standard"),
    ("Isaías", "Is", "ISAÍAS", 66, "standard"),
    ("Jeremías", "Jer", "JEREMÍAS", 52, "standard"),
    ("Lamentaciones", "Lam", "LAMENTACIONES", 5, "standard"),
    ("Baruc", "Bar", "BARUC", 6, "standard"),
    ("Ezequiel", "Ez", "EZEQUIEL", 48, "standard"),
    ("Daniel", "Dan", "DANIEL", 14, "standard"),
    ("Oseas", "Os", "OSEAS", 14, "standard"),
    ("Joel", "Jl", "JOEL", 4, "standard"),
    ("Amós", "Am", "AMÓS", 9, "standard"),
    ("Abdías", "Abd", "ABDÍAS", 1, "single"),
    ("Jonás", "Jon", "JONÁS", 4, "standard"),
    ("Miqueas", "Miq", "MIQUEAS", 7, "standard"),
    ("Nahún", "Nah", "NAHÚN", 3, "standard"),
    ("Habacuc", "Hab", "HABACUC", 3, "standard"),
    ("Sofonías", "Sof", "SOFONÍAS", 3, "standard"),
    ("Ageo", "Ag", "AGEO", 2, "standard"),
    ("Zacarías", "Zac", "ZACARÍAS", 14, "standard"),
    ("Malaquías", "Mal", "MALAQUÍAS", 3, "standard"),
    # Nuevo Testamento
    ("Mateo", "Mt", "MATEO", 28, "standard"),
    ("Marcos", "Mc", "MARCOS", 16, "standard"),
    ("Lucas", "Lc", "LUCAS", 24, "standard"),
    ("Juan", "Jn", "JUAN", 21, "standard"),
    ("Hechos de los Apóstoles", "Hch", "HECHOS DE LOS APÓSTOLES", 28, "standard"),
    ("Romanos", "Rom", "ROMANOS", 16, "standard"),
    ("1 Corintios", "1 Cor", "1 CORINTIOS", 16, "standard"),
    ("2 Corintios", "2 Cor", "2 CORINTIOS", 13, "standard"),
    ("Gálatas", "Gal", "GÁLATAS", 6, "standard"),
    ("Efesios", "Ef", "EFESIOS", 6, "standard"),
    ("Filipenses", "Flp", "FILIPENSES", 4, "standard"),
    ("Colosenses", "Col", "COLOSENSES", 4, "standard"),
    ("1 Tesalonicenses", "1 Tes", "1 TESALONICENSES", 5, "standard"),
    ("2 Tesalonicenses", "2 Tes", "2 TESALONICENSES", 3, "standard"),
    ("1 Timoteo", "1 Tim", "1 TIMOTEO", 6, "standard"),
    ("2 Timoteo", "2 Tim", "2 TIMOTEO", 4, "standard"),
    ("Tito", "Tit", "TITO", 3, "standard"),
    ("Filemón", "Flm", "FILEMÓN", 1, "single"),
    ("Hebreos", "Heb", "HEBREOS", 13, "standard"),
    ("Santiago", "Sant", "SANTIAGO", 5, "standard"),
    ("1 Pedro", "1 Pe", "1 PEDRO", 5, "standard"),
    ("2 Pedro", "2 Pe", "2 PEDRO", 3, "standard"),
    ("1 Juan", "1 Jn", "1 JUAN", 5, "standard"),
    ("2 Juan", "2 Jn", "2 JUAN", 1, "single"),
    ("3 Juan", "3 Jn", "3 JUAN", 1, "single"),
    ("Judas", "Jud", "JUDAS", 1, "single"),
    ("Apocalipsis", "Ap", "APOCALIPSIS", 22, "standard"),
]


# ---------------------------------------------------------------------------
# Text cleanup helpers
# ---------------------------------------------------------------------------

def normalize_whitespace(text: str) -> str:
    text = text.replace("\u00ad", "")  # soft hyphen
    # un-hyphenate words split across line breaks: "pala-\nbra" -> "palabra"
    text = re.sub(r"-\n\s*", "", text)
    text = re.sub(r"\s+", " ", text)
    return text.strip()


def strip_footnote_asterisks(text: str) -> str:
    return re.sub(r"\*+", "", text)


def is_cross_ref_line(line: str) -> bool:
    """A cross-reference line looks like '1: Gén 2,4-25; Sal 8 | 3: Foo 1,2'.

    Also catches continuation lines like '55,1; Ap 21,6 | 20: Hch 3,20s' which
    occur when a cross-ref block wraps to a second line.
    """
    s = line.strip()
    if not s:
        return False
    # Standard cross-ref start: "N: Book ..."
    if re.match(
        r"^\d+(?:[.,:\-]\d+)*\s*:\s+[12]?\s*[A-ZÁÉÍÓÚÑa-záéíóúñ]+\s*\d", s
    ):
        return True
    # Continuation line: starts with "<num>,<num>" (verse-style ref) and
    # contains a typical cross-ref separator (`|` or `;`).
    if re.match(r"^\d+,\d+[a-z]?\s*[|;]", s):
        return True
    return False


def strip_chapter_noise(chunk: str) -> str:
    """Remove lines that are clearly cross-refs/headers, keeping verse lines.

    Also truncates the chunk if a footnote-section marker is encountered (e.g.
    ``*1,1-2,4a Primer relato...``) — this protects the last book's last
    chapter from absorbing all trailing scholarly notes.
    """
    out = []
    for line in chunk.split("\n"):
        # Footnote section marker: "*<chap>,<verse>" anywhere in the line
        if re.search(r"\*\d+,\d", line):
            break
        if is_cross_ref_line(line):
            continue
        out.append(line)
    return "\n".join(out)


# ---------------------------------------------------------------------------
# Verse parser
# ---------------------------------------------------------------------------

def parse_verses_from_chapter_text(
    chapter_text: str, book_name: str, abbr: str, chapter_num: int
) -> list[dict]:
    """
    Walk through `chapter_text` looking for monotonic verse numbers (1, 2, 3...).
    chapter_text typically starts with the verse-1 marker, e.g. "1 Al principio..."
    but may also start with verse content directly (verse 1 marker missing) — in
    which case we synthesise verse 1 from text before the first found marker.
    """
    flat = normalize_whitespace(strip_footnote_asterisks(chapter_text))

    # Verse markers can be followed by space, letter, quote, or punctuation
    # (some PDFs squish "1Word" with no space).
    candidates: list[tuple[int, int, int, int]] = []  # (start_of_marker, end_after_marker, verse_num, marker_len)
    for m in re.finditer(
        r"(?:^|\s)(\d{1,3})(?=[\s«¿\"“A-ZÁÉÍÓÚÑ]|[a-záéíóúñ])",
        flat,
    ):
        n = int(m.group(1))
        # Position right after the digits
        digit_start = m.start(1)
        digit_end = m.end(1)
        # Skip optional whitespace following the marker
        after = digit_end
        while after < len(flat) and flat[after] == " ":
            after += 1
        candidates.append((m.start(), after, n, after - m.start()))

    expected = 1
    chosen: list[tuple[int, int]] = []  # (text_start, verse_num)
    for start, after, n, marker_len in candidates:
        if n == expected:
            chosen.append((after, n))
            expected += 1

    verses: list[dict] = []

    # If verse 1 wasn't found, but verse 2 was (meaning chapter started with
    # implicit verse 1 content), synthesise verse 1.
    if chosen and chosen[0][1] == 2:
        # The first chosen entry is verse 2 — find the marker position to know
        # where verse 1 ends.
        # We need the original marker position for verse 2, not text_start.
        # Re-find verse 2's marker
        for start, after, n, marker_len in candidates:
            if n == 2:
                v1_text = re.sub(r"\s+", " ", flat[:start]).strip()
                if v1_text:
                    verses.append({
                        "libro": book_name,
                        "abbr": abbr,
                        "capitulo": chapter_num,
                        "versiculo": 1,
                        "texto": v1_text,
                    })
                break

    for i, (text_start, n) in enumerate(chosen):
        if i + 1 < len(chosen):
            # Need the marker start of the next chosen verse
            next_n = chosen[i + 1][1]
            for start, after, vn, marker_len in candidates:
                if vn == next_n and after == chosen[i + 1][0]:
                    text_end = start
                    break
            else:
                text_end = len(flat)
        else:
            text_end = len(flat)
        verse_text = re.sub(r"\s+", " ", flat[text_start:text_end]).strip()
        if verse_text:
            verses.append(
                {
                    "libro": book_name,
                    "abbr": abbr,
                    "capitulo": chapter_num,
                    "versiculo": n,
                    "texto": verse_text,
                }
            )
    return verses


# ---------------------------------------------------------------------------
# Per-book chapter extractors
# ---------------------------------------------------------------------------

def extract_standard_book(
    book_chunk: str, name: str, abbr: str, total_chaps: int
) -> tuple[list[dict], list[int]]:
    """Books with chapter markers like 'Gén1 1 ' or '1 Sam3 1 '.

    Two-pass strategy:
      Pass 1: chapter markers followed by a verse-1 indicator (covers ~99%).
      Pass 2: for missing chapters, allow chapter markers without an explicit
              verse-1 (Job 24 and similar cases).
    """
    # Pass 1: chapter followed by verse 1 marker (with various separators)
    primary = re.compile(
        rf"(?<![\w]){re.escape(abbr)}(\d{{1,3}})\*?\s*(?=1[\s*A-ZÁÉÍÓÚÑa-záéíóúñ«¿\"“])",
        re.MULTILINE,
    )
    # chap -> (header_start, content_start)
    starts_dict: dict[int, tuple[int, int]] = {}
    for m in primary.finditer(book_chunk):
        chap = int(m.group(1))
        if 1 <= chap <= total_chaps and chap not in starts_dict:
            starts_dict[chap] = (m.start(), m.end())

    # Pass 2: any chapter marker (no verse-1 lookahead) for missing chapters
    fallback = re.compile(
        rf"(?<![\w]){re.escape(abbr)}(\d{{1,3}})\*?(?![\d])",
        re.MULTILINE,
    )
    for m in fallback.finditer(book_chunk):
        chap = int(m.group(1))
        if 1 <= chap <= total_chaps and chap not in starts_dict:
            starts_dict[chap] = (m.start(), m.end())

    sorted_starts = sorted(starts_dict.items())  # [(chap, (header_start, content_start)), ...]
    all_verses: list[dict] = []
    for i, (chap, (_hs, content_start)) in enumerate(sorted_starts):
        # End at the START of the next chapter's header, so the next chapter's
        # marker text doesn't bleed into this chapter's last verse.
        end = sorted_starts[i + 1][1][0] if i + 1 < len(sorted_starts) else len(book_chunk)
        chunk = book_chunk[content_start:end]
        chunk = strip_chapter_noise(chunk)
        verses = parse_verses_from_chapter_text(chunk, name, abbr, chap)
        all_verses.extend(verses)
    return all_verses, [s[0] for s in sorted_starts]


def extract_salmos(book_chunk: str, name: str, abbr: str) -> tuple[list[dict], list[int]]:
    """Each psalm is its own 'chapter'. Markers: 'Salmo N*' or 'Salmo N (M)'."""
    # Pass 1: standard same-line marker
    primary = re.compile(r"Salmo\s+(\d+)\s*(?:\(\d+\))?\*?", re.MULTILINE)
    starts_dict: dict[int, tuple[int, int]] = {}  # psalm -> (header_start, content_start)
    for m in primary.finditer(book_chunk):
        psalm = int(m.group(1))
        if 1 <= psalm <= 150 and psalm not in starts_dict:
            starts_dict[psalm] = (m.start(), m.end())

    # Pass 2: fragmented marker (Salmo + intervening cross-refs + N (M)*)
    fragmented = re.compile(
        r"\bSalmo\b[\s\S]{0,500}?(\d{1,3})\s*\((\d{1,3})\)\*?",
        re.MULTILINE,
    )
    for m in fragmented.finditer(book_chunk):
        psalm = int(m.group(1))
        if 1 <= psalm <= 150 and psalm not in starts_dict:
            starts_dict[psalm] = (m.start(), m.end())

    sorted_starts = sorted(starts_dict.items())
    all_verses: list[dict] = []
    for i, (psalm, (_hs, content_start)) in enumerate(sorted_starts):
        end = sorted_starts[i + 1][1][0] if i + 1 < len(sorted_starts) else len(book_chunk)
        chunk = book_chunk[content_start:end]
        chunk = strip_chapter_noise(chunk)
        verses = parse_verses_from_chapter_text(chunk, name, abbr, psalm)
        all_verses.extend(verses)
    return all_verses, [s[0] for s in sorted_starts]


def extract_single_chapter_book(
    book_chunk: str, name: str, abbr: str
) -> tuple[list[dict], list[int]]:
    """Books with only one chapter (Abdías, Filemón, 2 Juan, 3 Juan, Judas).

    The book chunk starts with the all-caps header and (typically) an intro
    paragraph. We need to skip past the intro and find verse 1.
    Approach: look for the first occurrence of " 1 " followed by a capital letter
    or a quoted phrase that begins a verse.
    """
    chunk = strip_chapter_noise(book_chunk)
    # Find a "verse-1-ish" marker. Prefer a line that begins with "1 " followed
    # by an uppercase letter (start of verse text).
    # Try to locate the first plausible verse-1 marker
    m = re.search(r"(?:^|\n)\s*1\s+[«¿“\"A-ZÁÉÍÓÚÑa-záéíóúñ]", chunk, re.MULTILINE)
    if not m:
        # fallback: any " 1 "
        m = re.search(r"\s1\s", chunk)
    if not m:
        return [], []
    body = chunk[m.start():]
    # Trim potential leading whitespace before "1"
    body = re.sub(r"^\s+", "", body)
    verses = parse_verses_from_chapter_text(body, name, abbr, 1)
    return verses, [1]


# ---------------------------------------------------------------------------
# Main pipeline
# ---------------------------------------------------------------------------

def find_book_chunks(raw: str) -> dict[str, tuple[int, int]]:
    """Locate each book's start in the raw text using its all-caps header.

    The header is a unique standalone occurrence. We prefer a header that is
    NOT inside a cross-references block and is followed by an introduction
    paragraph. Heuristic: find the LAST occurrence of the header that has
    a substantial following body before the next book's header.

    We do this in two passes:
      1. Build a dict of header -> list of all positions.
      2. Walk books in canonical order. For each book, choose the position
         closest to (but greater than) the previous book's start.
    """
    header_positions: dict[str, list[int]] = {}
    for _name, _abbr, header, _total, _kind in BOOKS:
        positions: list[int] = []
        if re.match(r"^\d\s+", header):
            digit, rest = header.split(" ", 1)
            # Try the digit + (possibly newline-separated) rest
            pat = rf"(?<![\w]){digit}\s{{0,80}}{re.escape(rest)}(?![\wÁÉÍÓÚÑáéíóúñ])"
            positions.extend(m.start() for m in re.finditer(pat, raw))
            # Fallback: bare `rest` (e.g. "CORINTIOS") in case the leading digit
            # got fully detached. We'll filter later by the order constraint.
            bare_pat = rf"\b{re.escape(rest)}\b"
            positions.extend(m.start() for m in re.finditer(bare_pat, raw))
            positions = sorted(set(positions))
        else:
            pat = rf"\b{re.escape(header)}\b"
            positions = [m.start() for m in re.finditer(pat, raw)]
        header_positions[header] = positions

    chunks: dict[str, tuple[int, int]] = {}
    last_pos = 0
    book_keys = [b[2] for b in BOOKS]

    for i, header in enumerate(book_keys):
        positions = header_positions.get(header, [])
        candidates = [p for p in positions if p > last_pos]
        if not candidates:
            continue
        # Choose the FIRST candidate after last_pos — that's the actual book
        # header (cross-references and TOC mentions come before, but the table
        # of contents lists books in lowercase, not all-caps).
        # However sometimes the all-caps header appears in a section title
        # within a previous book (e.g., "JUDAS MACABEO" inside 1 Macabeos).
        # We pick the candidate that has a paragraph break right after it
        # AND is followed by reasonable scripture content.
        chosen = None
        for p in candidates:
            # Header should be followed by either intro text or first verse
            after = raw[p + len(header) : p + len(header) + 200]
            if re.match(r"\s*\n", after):  # paragraph break -> likely book header
                chosen = p
                break
        if chosen is None:
            chosen = candidates[0]
        chunks[header] = (chosen + len(header), chosen)  # end set later, tmp store header start
        # Advance last_pos past the chosen match so a bare-suffix match (e.g.
        # "CORINTIOS" inside "1 CORINTIOS") isn't reused for the next book.
        last_pos = chosen + len(header)

    # Now compute end positions: each book ends where the next one's HEADER
    # starts (NOT after its header) so that the next book's header text doesn't
    # leak into the previous book's last chapter.
    keys = list(chunks.keys())
    header_starts = [(k, chunks[k][1]) for k in keys]  # second tuple slot held header start
    for i, (k, _hs) in enumerate(header_starts):
        s = chunks[k][0]
        end = header_starts[i + 1][1] if i + 1 < len(header_starts) else len(raw)
        chunks[k] = (s, end)
    return chunks


def main() -> None:
    if not RAW_TXT.exists():
        print(f"ERROR: {RAW_TXT} no existe.", file=sys.stderr)
        sys.exit(1)
    raw = RAW_TXT.read_text(encoding="utf-8")

    chunks = find_book_chunks(raw)

    all_verses: list[dict] = []
    summary: list[str] = []

    for name, abbr, header, total, kind in BOOKS:
        if header not in chunks:
            summary.append(f"  ⚠  {name} ({abbr}): NO ENCONTRADO el header")
            continue
        start, end = chunks[header]
        book_chunk = raw[start:end]

        if kind == "salmos":
            verses, found_chaps = extract_salmos(book_chunk, name, abbr)
        elif kind == "single":
            verses, found_chaps = extract_single_chapter_book(book_chunk, name, abbr)
        else:
            verses, found_chaps = extract_standard_book(book_chunk, name, abbr, total)

        all_verses.extend(verses)
        flag = "✓" if len(found_chaps) >= total else "⚠"
        summary.append(
            f"  {flag}  {name} ({abbr}): {len(found_chaps)}/{total} cap, {len(verses)} versículos"
        )

    print("=== RESUMEN ===")
    for line in summary:
        print(line)
    print(f"\nTotal versículos: {len(all_verses)}")

    OUT_JSON.parent.mkdir(parents=True, exist_ok=True)
    OUT_JSON.write_text(
        json.dumps(all_verses, ensure_ascii=False, indent=0).replace("\n", ""),
        encoding="utf-8",
    )
    # Re-write with proper formatting
    OUT_JSON.write_text(json.dumps(all_verses, ensure_ascii=False), encoding="utf-8")
    print(f"\nEscrito {OUT_JSON} ({OUT_JSON.stat().st_size / 1024 / 1024:.2f} MB)")


if __name__ == "__main__":
    main()
