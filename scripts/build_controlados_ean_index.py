"""Converte controlados.txt (base validada por EAN) em JSON.

Formato da linha (;):
  tipo;lista;registroMS;unidade;apresentacao;...;dcbAnvisa;EAN

Uso:
  python scripts/build_controlados_ean_index.py [caminho.txt]
"""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
REF = ROOT / "data" / "reference"
DEFAULT_SRC = Path(r"c:\Users\tools\OneDrive\Desktop\controlados.txt")
OUT_JSON = REF / "controlados-ean-index.json"
OUT_COPY = REF / "controlados.txt"


def clean_ean(value: str) -> str | None:
    digits = re.sub(r"\D", "", value or "")
    return digits if len(digits) >= 8 else None


def map_lista(tipo: str, lista: str) -> str:
    t = (tipo or "").strip().upper()
    l = (lista or "").strip().upper()
    if t.startswith("ANTIMICRO"):
        return "T"
    if l in {"", "-", "---", "NENHUMA", "NENHUM"}:
        return ""
    return l


def read_lines(path: Path) -> list[str]:
    for enc in ("cp1252", "latin-1", "utf-8", "utf-8-sig"):
        try:
            return path.read_text(encoding=enc).splitlines()
        except UnicodeDecodeError:
            continue
    raise SystemExit(f"Nao foi possivel ler {path}")


def main() -> None:
    src = Path(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT_SRC
    if not src.exists():
        raise SystemExit(f"Arquivo nao encontrado: {src}")

    REF.mkdir(parents=True, exist_ok=True)
    # Copia a fonte validada para o repositorio
    OUT_COPY.write_bytes(src.read_bytes())

    by_ean: dict[str, dict] = {}
    by_lista: dict[str, int] = {}
    skipped = 0

    for line in read_lines(src):
        line = line.strip()
        if not line:
            continue
        parts = line.split(";")
        if len(parts) < 12:
            skipped += 1
            continue
        ean = clean_ean(parts[-1])
        if not ean:
            skipped += 1
            continue
        tipo = parts[0].strip()
        lista = map_lista(tipo, parts[1])
        if not lista:
            skipped += 1
            continue
        registro = parts[2].strip()
        unidade = parts[3].strip()
        apresentacao = parts[4].strip()
        dcb = re.sub(r"\D", "", parts[10]) if len(parts) > 10 else ""
        # col 6 costuma ser qtd por embalagem na base validada
        unidemb = parts[6].strip() if len(parts) > 6 else ""

        by_ean[ean] = {
            "lista": lista,
            "tipo": "ANTIMICROBIANO" if lista == "T" else "CONTROLE_ESPECIAL",
            "registro": registro,
            "dcb": dcb.zfill(5) if dcb else "",
            "unidade": unidade,
            "apresentacao": apresentacao,
            "unidemb": unidemb,
        }
        by_lista[lista] = by_lista.get(lista, 0) + 1

    payload = {
        "source": str(src.name),
        "note": "Base validada por EAN (controlados.txt). Prioridade sobre match por substancia CMED/Portaria.",
        "eanCount": len(by_ean),
        "byLista": by_lista,
        "byEan": by_ean,
    }
    OUT_JSON.write_text(
        json.dumps(payload, ensure_ascii=False, separators=(",", ":")),
        encoding="utf-8",
    )
    print(f"OK {OUT_JSON} — {len(by_ean)} EANs {by_lista} (skipped {skipped})")


if __name__ == "__main__":
    main()
