"""
Extracts the "Credo: Compendio de la Fe Católica" (Bishop Athanasius Schneider)
into structured Q&A JSON.

Run:
    pdftotext -enc UTF-8 -layout Contexto/credo.pdf data/credo-raw.txt
    python scripts/extract_credo.py

Output: data/credo.json — a list of { numero, pregunta, respuesta }.

Each Q&A pair is self-contained and used as a single retrieval chunk: the
embedding is computed over the concatenation "Pregunta\n\nRespuesta" so a
semantic query can match either the question or the answer body.
"""

from __future__ import annotations

import io
import json
import re
import sys
from pathlib import Path

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

ROOT = Path(__file__).resolve().parent.parent
RAW_TXT = ROOT / "data" / "credo-raw.txt"
OUT_JSON = ROOT / "data" / "credo.json"


QA_HEADER_RE = re.compile(
    r"^\s*(?P<num>\d{1,4})\.\s+(?P<q>[¿«].+?\??[?»])\s*$",
    re.MULTILINE,
)


def normalize_block(text: str) -> str:
    text = text.replace("\u00ad", "")
    # un-hyphenate "pala-\nbra" -> "palabra"
    text = re.sub(r"-\n\s*", "", text)
    text = re.sub(r"\s+", " ", text).strip()
    return text


def main() -> None:
    if not RAW_TXT.exists():
        print(f"ERROR: {RAW_TXT} no existe.", file=sys.stderr)
        sys.exit(1)

    raw = RAW_TXT.read_text(encoding="utf-8")
    matches = list(QA_HEADER_RE.finditer(raw))
    print(f"Detectados {len(matches)} marcadores Q&A en bruto")

    # The compendium is divided into multiple parts; each part restarts the
    # numbering, so we accept ALL valid Q&A markers in document order.
    # Filter out obvious false positives: questions that are too short to be
    # real Q&As (under 8 chars after the leading "¿").
    chosen: list[tuple[re.Match, int]] = []
    for m in matches:
        n = int(m.group("num"))
        q_text = m.group("q").strip()
        if len(q_text) < 10:
            continue
        chosen.append((m, n))

    print(f"Q&A pairs aceptados: {len(chosen)}")
    if not chosen:
        sys.exit("No se encontró ninguna pregunta válida.")

    # Pattern that catches a "missed" Q&A header inside an answer body — used
    # to truncate run-on answers (e.g. multi-line questions our header regex
    # didn't pick up).
    INNER_QA_RE = re.compile(r"\s\d{1,4}\.\s+[¿«]")

    items: list[dict] = []
    for i, (m, n) in enumerate(chosen):
        q = m.group("q").strip()
        body_start = m.end()
        body_end = chosen[i + 1][0].start() if i + 1 < len(chosen) else len(raw)
        body = normalize_block(raw[body_start:body_end])

        # If this body absorbed a missed Q&A header, cut at that point.
        cut = INNER_QA_RE.search(body)
        if cut:
            body = body[: cut.start()].strip()

        # Hard cap — anything beyond 2500 chars is almost certainly noise
        # (an appendix or table swallowed by the regex).
        if len(body) > 2500:
            body = body[:2500].rsplit(" ", 1)[0] + "…"

        if len(body) < 30:
            continue
        items.append(
            {"id": i, "numero": n, "pregunta": q, "respuesta": body}
        )

    OUT_JSON.parent.mkdir(parents=True, exist_ok=True)
    OUT_JSON.write_text(
        json.dumps(items, ensure_ascii=False),
        encoding="utf-8",
    )
    sizes = [len(it["respuesta"]) for it in items]
    sizes.sort()
    print(
        f"Escrito {OUT_JSON} — {len(items)} Q&A "
        f"({OUT_JSON.stat().st_size / 1024 / 1024:.2f} MB) — "
        f"respuesta median {sizes[len(sizes) // 2]} chars, max {sizes[-1]}"
    )


if __name__ == "__main__":
    main()
