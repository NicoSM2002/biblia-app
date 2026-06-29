"""
Merges the two complementary doctrinal sources into a single retrieval index
that reuses the existing "credo" pipeline (credo.json -> embeddings -> bin):

  - Catechism of the Catholic Church paragraphs (data/cic.json)
  - Mons. Straubinger's exegetical footnotes    (data/straubinger-notes.json)

Both are used only to *enrich* pastoral answers (never quoted verbatim, per the
product decision), so they share the CredoQA shape {id, numero, pregunta,
respuesta}. `pregunta` is left empty so nothing invites the model to cite it;
the doctrinal text lives entirely in `respuesta`. A `fuente` field is kept for
debugging and is ignored by the TypeScript types.

Output: data/credo.json
"""

from __future__ import annotations

import io
import json
import re
import sys
from pathlib import Path

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

ROOT = Path(__file__).resolve().parent.parent
CIC = ROOT / "data" / "cic.json"
NOTES = ROOT / "data" / "straubinger-notes.json"
OUT = ROOT / "data" / "credo.json"

MIN_NOTE_LEN = 120


def is_cross_ref(t: str) -> bool:
    """Notes that are essentially Scripture cross-reference lists carry little
    standalone doctrinal value."""
    if len(t) < MIN_NOTE_LEN and re.match(r"^(Cf\.|Véase|Vide|V\.|Comp)", t):
        return True
    return False


def main() -> None:
    cic = json.loads(CIC.read_text(encoding="utf-8"))
    notes = json.loads(NOTES.read_text(encoding="utf-8"))

    items: list[dict] = []
    idx = 0

    for p in cic:
        items.append({
            "id": idx, "numero": p["numero"], "pregunta": "",
            "respuesta": p["texto"], "fuente": "catecismo",
        })
        idx += 1

    kept_notes = 0
    for n in notes:
        t = n["texto"].strip()
        if len(t) < MIN_NOTE_LEN or is_cross_ref(t):
            continue
        items.append({
            "id": idx, "numero": 0, "pregunta": "",
            "respuesta": t, "fuente": f"nota:{n['ref']}",
        })
        idx += 1
        kept_notes += 1

    OUT.write_text(json.dumps(items, ensure_ascii=False), encoding="utf-8")
    print(f"Catecismo: {len(cic)} párrafos")
    print(f"Notas Straubinger: {kept_notes} (de {len(notes)})")
    print(f"Total doctrina: {len(items)}")
    print(f"Escrito {OUT} ({OUT.stat().st_size/1024/1024:.2f} MB)")


if __name__ == "__main__":
    main()
