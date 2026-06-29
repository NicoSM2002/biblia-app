"""
Extracts the Catechism of the Catholic Church (CIC, ed. típica 1997, ES) into
structured per-paragraph JSON.

The Catechism is numbered 1..2865. In the layout text each paragraph is
preceded by a centred marker line ("        27.") and its body repeats the
number ("27 El deseo de Dios..."). We anchor on the centred markers, take the
text up to the next marker, strip the repeated leading number, and trim any
section heading that trails into the next paragraph's block.

Source: Contexto/catecismo.pdf (CIC ed. típica 1997, ES). The layout text is
derived on the fly with `pdftotext -enc UTF-8 -layout` (falls back to a cached
data/cic-raw.txt if the binary is unavailable).

Output: data/cic.json — [{id, numero, texto}]
"""

from __future__ import annotations

import io
import json
import re
import subprocess
import sys
from pathlib import Path

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

ROOT = Path(__file__).resolve().parent.parent
PDF = ROOT / "Contexto" / "catecismo.pdf"
RAW = ROOT / "data" / "cic-raw.txt"
OUT = ROOT / "data" / "cic.json"


def ensure_raw() -> None:
    """Regenerate the layout text from the PDF when possible; otherwise reuse
    the cached copy committed under data/."""
    if not PDF.exists():
        if RAW.exists():
            return
        sys.exit(f"No existe {PDF} ni {RAW}.")
    try:
        subprocess.run(
            ["pdftotext", "-enc", "UTF-8", "-layout", str(PDF), str(RAW)],
            check=True,
        )
    except (FileNotFoundError, subprocess.CalledProcessError) as e:
        if not RAW.exists():
            sys.exit(f"pdftotext no disponible y no hay cache: {e}")

MARKER_RE = re.compile(r"^\s*(\d{1,4})\.\s*$")
# Body of a paragraph repeats its number: "27 El deseo de Dios...".
BODY_RE = re.compile(r"^\s*(\d{1,4})\s+[«\"“A-ZÁÉÍÓÚÑ]")

HEADING_RE = re.compile(
    r"^(CAP[IÍ]TULO|ART[IÍ]CULO|SECCI[OÓ]N|P[aá]rrafo|PRIMERA|SEGUNDA|TERCERA|"
    r"CUARTA|QUINTA)\b|^[IVX]+\s*[\.\-]|^[A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑ \-\":,]+$"
)


def is_heading(line: str) -> bool:
    s = line.strip()
    if not s:
        return True
    if HEADING_RE.match(s):
        return True
    # Roman-numeral list headers like "I.- EL DESEO DE DIOS"
    if re.match(r"^[IVX]+\.\-", s):
        return True
    return False


def normalize(text: str) -> str:
    text = text.replace("­", "")
    text = re.sub(r"-\n\s*", "", text)          # un-hyphenate across line breaks
    text = re.sub(r"\s+", " ", text)
    return text.strip()


def main() -> None:
    ensure_raw()
    raw = RAW.read_text(encoding="utf-8")
    raw = raw.replace("\x0c", "")               # drop page-break glyphs
    lines = raw.split("\n")

    # Pass 1 — centred/col-0 markers "N.", kept monotonic to ignore stray
    # enumerations inside quoted citations.
    anchors: list[tuple[int, int, str]] = []      # (num, line_index, kind)
    last = 0
    for i, l in enumerate(lines):
        m = MARKER_RE.match(l)
        if m:
            n = int(m.group(1))
            if 1 <= n <= 2865 and n > last and n <= last + 15:
                anchors.append((n, i, "m"))
                last = n
    present = {a[0] for a in anchors}

    # Pass 2 — recover paragraphs lacking a marker by finding their body line
    # ("N Texto..."), bounded between the surrounding present anchors.
    by_line = sorted(anchors, key=lambda a: a[1])
    for n in range(1, 2866):
        if n in present:
            continue
        lo = max([a[1] for a in by_line if a[0] < n], default=-1)
        hi = min([a[1] for a in by_line if a[0] > n], default=len(lines))
        for i in range(lo + 1, hi):
            bm = BODY_RE.match(lines[i])
            if bm and int(bm.group(1)) == n:
                anchors.append((n, i, "b"))
                present.add(n)
                break

    anchors.sort(key=lambda a: a[1])

    items: list[dict] = []
    for k, (num, idx, kind) in enumerate(anchors):
        end = anchors[k + 1][1] if k + 1 < len(anchors) else len(lines)
        start = idx + 1 if kind == "m" else idx
        body = lines[start:end]

        # Trim trailing heading/blank lines that belong to the next section.
        while body and is_heading(body[-1]):
            body.pop()
        if not body:
            continue

        text = normalize("\n".join(body))
        # Strip the repeated leading paragraph number ("27 El deseo..." -> "El...")
        text = re.sub(rf"^{num}\b\s*", "", text).strip()
        if len(text) < 20:
            continue
        items.append({"id": k, "numero": num, "texto": text})

    OUT.write_text(json.dumps(items, ensure_ascii=False), encoding="utf-8")

    nums = {it["numero"] for it in items}
    missing = [n for n in range(1, 2866) if n not in nums]
    sizes = sorted(len(it["texto"]) for it in items)
    print(f"Párrafos extraídos: {len(items)}  (números distintos: {len(nums)})")
    print(f"Faltantes en 1..2865: {len(missing)} -> {missing[:20]}")
    print(f"Longitud: mediana {sizes[len(sizes)//2]} chars, max {sizes[-1]}")
    print(f"Escrito {OUT}")


if __name__ == "__main__":
    main()
