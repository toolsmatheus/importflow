# -*- coding: utf-8 -*-
"""Gera data/produtos-50-reais.csv com EANs reais do índice CMED."""
from __future__ import annotations

import json
import re
import unicodedata
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "data" / "produtos-50-reais.csv"

HEADERS = [
    "codigo",
    "nome",
    "codigogrupo",
    "custo",
    "markup",
    "venda",
    "fator",
    "listapiscofins",
    "aliquota",
    "cfop",
    "ncm",
    "cstpiscofins",
    "valorpmc",
    "codigobarras",
    "subgrupo",
    "categoria",
    "laboratorio",
    "grupodepreco",
    "similar",
    "estoque",
    "descontofixo",
    "comissao",
    "atualizaestoque",
    "demanda",
    "ativo",
    "st",
    "isento",
    "semincidencia",
    "permitedesconto",
    "localizacao",
    "usocontinuo",
    "observacao",
    "descontomax",
    "cest",
    "csosn",
    "csticms",
    "medfciapop",
    "qtdfciapop",
    "valorfciapop",
    "listacontrole",
    "dcb",
    "registroms",
    "unidemb",
    "unidadesngpc",
]

DCB_AUX = {
    "DIPIRONA": "1",
    "AMOXICILINA": "2",
    "ESCITALOPRAM": "3",
    "CLONAZEPAM": "4",
    "ZOLPIDEM": "5",
    "FLUOXETINA": "6",
    "SERTRALINA": "7",
    "ALPRAZOLAM": "8",
    "PREGABALINA": "9",
    "MORFINA": "10",
    "METILFENIDATO": "11",
    "DIAZEPAM": "12",
    "AZITROMICINA": "13",
    "CEFALEXINA": "14",
}

ANTIBIOTIC_KEYS = (
    "AMOXICILINA",
    "AZITROMICINA",
    "CEFALEXINA",
    "CIPROFLOXACINO",
    "LEVOFLOXACINO",
    "CLARITROMICINA",
    "DOXICICLINA",
)


def norm(s: str) -> str:
    s = unicodedata.normalize("NFD", s)
    s = "".join(c for c in s if unicodedata.category(c) != "Mn")
    return re.sub(r"\s+", " ", s.upper().strip())


def primary_substance(s: str) -> str:
    parts = [p.strip() for p in s.split(";") if p.strip()]
    if not parts:
        return ""
    p = parts[0]
    for pref in (
        "CLORIDRATO DE ",
        "SULFATO DE ",
        "HEMITARTARATO DE ",
        "OXALATO DE ",
        "MALEATO DE ",
        "BESILATO DE ",
        "MONOIDRATADA",
    ):
        if p.startswith(pref):
            p = p[len(pref) :].strip()
    # dipirona monoidratada etc
    p = re.sub(r"\s+MONOIDRATAD[AO]$", "", p)
    p = p.replace(" MONOIDRATADA", "").replace(" MONOIDRATADO", "")
    return p.strip()


def br_money(n: float) -> str:
    return f"{n:.2f}".replace(".", ",")


def find_lista(substance: str, port: dict[str, str]) -> str | None:
    n = norm(substance)
    if n in port:
        return port[n]
    for k, v in port.items():
        kn = norm(k)
        if kn == n or kn in n or n in kn:
            return v
    return None


def find_dcb(substance: str) -> str:
    n = norm(substance)
    for k, vid in DCB_AUX.items():
        if k in n:
            return vid
    return ""


def is_antibiotic(substance: str) -> bool:
    n = norm(substance)
    return any(k in n for k in ANTIBIOTIC_KEYS)


def pick(
    by_ean: dict,
    predicate,
    limit: int = 20,
) -> list[tuple[str, dict]]:
    out: list[tuple[str, dict]] = []
    for ean, info in by_ean.items():
        if not (ean.startswith("789") or ean.startswith("790")):
            continue
        if predicate(ean, info):
            out.append((ean, info))
            if len(out) >= limit:
                break
    return out


def product_name(info: dict, substance: str) -> str:
    brand = str(info.get("p") or "").strip()
    # Preferir ativo conhecido do nosso auxiliar DCB
    known = ""
    nsub = norm(substance)
    for key in DCB_AUX:
        if key in nsub:
            known = key.title()
            break
    sub = known or primary_substance(substance) or substance.split(";")[0].strip()
    if brand and brand not in ("-", "(*)") and norm(brand) != norm(sub):
        return f"{brand} ({sub})"[:80]
    return sub[:80]


def build_row(
    codigo: int,
    ean: str,
    info: dict,
    *,
    kind: str,
    lista_pis: str,
    fiscal: str,
    grupo: str = "1",
    subgrupo: str = "1",
    categoria: str = "1",
    laboratorio: str = "1",
    grupodepreco: str = "1",
    similar: str = "",
    custo: float,
    markup: float,
    unidemb: str = "",
    medfp: bool = False,
    observacao: str = "",
    port: dict[str, str],
) -> dict[str, str]:
    substance = str(info.get("s") or "")
    reg = str(info.get("r") or "").strip()
    nome = product_name(info, substance).upper()
    venda = custo * (1 + markup / 100)

    aliquota = "17"
    st, isento = "N", "N"
    cfop = "5102"
    cest = "1300100"
    ncm = "30049099"
    if fiscal == "aliquota18":
        aliquota = "18"
    elif fiscal == "aliquota12":
        aliquota = "12"
    elif fiscal == "isento":
        aliquota = "0"
        isento = "S"
        st = "N"
        cfop = "5102"
    elif fiscal == "st":
        aliquota = "0"
        st = "S"
        isento = "N"
        cfop = "5405"
        cest = "0300100"
        ncm = "22021000"
        grupo = "3"
        categoria = "2"
        subgrupo = "1"

    listacontrole = ""
    dcb = ""
    registroms = ""
    unidadesngpc = ""
    if kind == "controlado":
        listacontrole = find_lista(primary_substance(substance), port) or find_lista(
            substance, port
        ) or "B1"
        dcb = find_dcb(substance)
        registroms = reg
        unidadesngpc = "CAIXA"
        if not unidemb:
            unidemb = "30"
        subgrupo = "1"
    elif kind == "antibiotico":
        listacontrole = "T"
        dcb = find_dcb(substance) or "2"
        registroms = reg
        unidadesngpc = "CAIXA"
        if not unidemb:
            unidemb = "21"
        subgrupo = "2"
        grupo = "1"
    else:
        # normal: sem campos de controlado
        unidemb = ""
        unidadesngpc = ""
        listacontrole = ""
        dcb = ""
        registroms = ""

    if fiscal == "st":
        # ST convenience items shouldn't be controlados
        listacontrole = dcb = registroms = unidemb = unidadesngpc = ""

    row = {h: "" for h in HEADERS}
    row.update(
        {
            "codigo": str(codigo),
            "nome": nome,
            "codigogrupo": grupo,
            "custo": br_money(custo),
            "markup": br_money(markup),
            "venda": br_money(venda),
            "fator": "1",
            "listapiscofins": lista_pis,
            "aliquota": aliquota,
            "cfop": cfop,
            "ncm": ncm,
            "cstpiscofins": "01",
            "valorpmc": br_money(venda * 1.05),
            "codigobarras": ean,
            "subgrupo": subgrupo,
            "categoria": categoria,
            "laboratorio": laboratorio,
            "grupodepreco": grupodepreco,
            "similar": similar,
            "estoque": "25",
            "descontofixo": "0",
            "comissao": "2",
            "atualizaestoque": "S",
            "demanda": "5",
            "ativo": "A",
            "st": st,
            "isento": isento,
            "semincidencia": "N",
            "permitedesconto": "S",
            "localizacao": f"A{(codigo % 5) + 1}-P{(codigo % 9) + 1:02d}",
            "usocontinuo": "S" if kind == "normal" and "LOSARTANA" in norm(substance) else "N",
            "observacao": observacao,
            "descontomax": "10",
            "cest": cest,
            "csosn": "",
            "csticms": "",
            "medfciapop": "S" if medfp else "N",
            "qtdfciapop": "30" if medfp else "",
            "valorfciapop": br_money(venda * 0.5) if medfp else "",
            "listacontrole": listacontrole,
            "dcb": dcb,
            "registroms": registroms,
            "unidemb": unidemb,
            "unidadesngpc": unidadesngpc,
        }
    )
    return row


def main() -> None:
    idx = json.loads(
        (ROOT / "data/reference/cmed-ean-index.json").read_text(encoding="utf-8")
    )
    port = json.loads(
        (ROOT / "data/reference/portaria344.json").read_text(encoding="utf-8")
    )["lists"]
    by_ean: dict = idx["byEan"]

    def ps(info: dict) -> str:
        return norm(primary_substance(str(info.get("s") or "")))

    pools: dict[str, list[tuple[str, dict]]] = {
        "dipirona": pick(
            by_ean,
            lambda e, i: ps(i) in ("DIPIRONA", "DIPIRONA MONOIDRATADA")
            or (
                norm(primary_substance(str(i.get("s") or ""))) == "DIPIRONA"
            ),
            12,
        ),
        "neosaldina": pick(
            by_ean,
            lambda e, i: "ISOMETEPTENO" in norm(i["s"]) and "DIPIRONA" in norm(i["s"]),
            3,
        ),
        "dorflex": pick(
            by_ean,
            lambda e, i: "ORFENADRINA" in norm(i["s"]) and "DIPIRONA" in norm(i["s"]),
            3,
        ),
        "paracetamol": pick(by_ean, lambda e, i: ps(i) == "PARACETAMOL", 6),
        "ibuprofeno": pick(by_ean, lambda e, i: ps(i) == "IBUPROFENO", 6),
        "losartana": pick(by_ean, lambda e, i: "LOSARTANA" in norm(i["s"]), 5),
        "omeprazol": pick(
            by_ean,
            lambda e, i: ps(i) in ("OMEPRAZOL", "OMEPRAZOL SODICO"),
            5,
        ),
        "amoxicilina": pick(by_ean, lambda e, i: ps(i) == "AMOXICILINA", 8),
        "azitromicina": pick(by_ean, lambda e, i: "AZITROMICINA" in norm(i["s"]), 5),
        "cefalexina": pick(by_ean, lambda e, i: "CEFALEXINA" in norm(i["s"]), 4),
        "clonazepam": pick(by_ean, lambda e, i: "CLONAZEPAM" in norm(i["s"]), 5),
        "alprazolam": pick(by_ean, lambda e, i: "ALPRAZOLAM" in norm(i["s"]), 5),
        "diazepam": pick(by_ean, lambda e, i: ps(i) == "DIAZEPAM", 4),
        "zolpidem": pick(by_ean, lambda e, i: "ZOLPIDEM" in norm(i["s"]), 4),
        "fluoxetina": pick(by_ean, lambda e, i: "FLUOXETINA" in norm(i["s"]), 4),
        "sertralina": pick(by_ean, lambda e, i: "SERTRALINA" in norm(i["s"]), 4),
        "escitalopram": pick(by_ean, lambda e, i: "ESCITALOPRAM" in norm(i["s"]), 3),
        "pregabalina": pick(by_ean, lambda e, i: "PREGABALINA" in norm(i["s"]), 3),
        "morfina": pick(by_ean, lambda e, i: "MORFINA" in norm(i["s"]), 3),
        "metilfenidato": pick(by_ean, lambda e, i: "METILFENIDATO" in norm(i["s"]), 3),
        "vitamina_c": pick(
            by_ean,
            lambda e, i: "ACIDO ASCORBICO" in norm(i["s"]),
            4,
        ),
        "soro": pick(
            by_ean,
            lambda e, i: "CLORETO DE SODIO" in norm(i["s"])
            and "GLICOSE" not in norm(i["s"]),
            4,
        ),
    }

    used_eans: set[str] = set()

    def take(pool_name: str) -> tuple[str, dict]:
        for ean, info in pools[pool_name]:
            if ean not in used_eans:
                used_eans.add(ean)
                return ean, info
        raise RuntimeError(f"Pool esgotado: {pool_name}")

    # 32 normal
    normal_specs = [
        ("dipirona", 5.5, 60, "NEUTRA", "aliquota18", "normal OTC", {}, "10"),
        ("dipirona", 4.8, 70, "NEUTRA", "aliquota17", "normal OTC", {}, "10"),
        ("neosaldina", 8.0, 55, "NEUTRA", "aliquota18", "normal OTC", {}, "20"),
        ("dorflex", 7.5, 50, "NEUTRA", "aliquota17", "normal OTC", {}, "36"),
        ("paracetamol", 6.0, 65, "POSITIVA", "aliquota18", "normal OTC", {}, "20"),
        ("paracetamol", 5.2, 70, "NEUTRA", "aliquota17", "normal OTC", {}, "20"),
        ("ibuprofeno", 7.0, 60, "NEGATIVA", "aliquota12", "normal OTC", {}, "10"),
        ("ibuprofeno", 6.5, 55, "NEUTRA", "aliquota18", "normal OTC", {}, "20"),
        ("losartana", 9.0, 50, "NEUTRA", "aliquota17", "normal FP", {"medfp": True}, "30"),
        ("losartana", 8.5, 55, "POSITIVA", "aliquota18", "normal", {}, "30"),
        ("omeprazol", 10.0, 45, "NEUTRA", "aliquota17", "normal", {}, "28"),
        ("omeprazol", 9.5, 50, "NEUTRA", "aliquota18", "normal", {}, "28"),
        ("fluoxetina", 12.0, 40, "NEUTRA", "aliquota17", "normal", {}, "30"),
        ("sertralina", 13.0, 42, "POSITIVA", "aliquota18", "normal", {}, "30"),
        ("escitalopram", 14.0, 40, "NEUTRA", "aliquota17", "normal", {}, "30"),
        ("pregabalina", 18.0, 35, "NEUTRA", "aliquota18", "normal", {}, "30"),
        ("vitamina_c", 3.5, 80, "NEUTRA", "isento", "normal isento", {"grupo": "1", "categoria": "2"}, "30"),
        ("vitamina_c", 4.0, 75, "NEUTRA", "isento", "normal isento", {"grupo": "1", "categoria": "2"}, "30"),
        ("soro", 2.5, 90, "NEUTRA", "isento", "normal isento", {"grupo": "1", "categoria": "2"}, "1"),
        ("soro", 2.8, 85, "NEUTRA", "isento", "normal isento", {"grupo": "1", "categoria": "2"}, "1"),
        ("dipirona", 5.0, 60, "NEGATIVA", "aliquota12", "normal OTC", {}, "10"),
        ("paracetamol", 5.5, 65, "NEUTRA", "aliquota17", "normal OTC", {}, "20"),
        ("ibuprofeno", 6.8, 58, "POSITIVA", "aliquota18", "normal OTC", {}, "10"),
        ("losartana", 9.2, 48, "NEUTRA", "aliquota17", "normal FP", {"medfp": True}, "30"),
        ("omeprazol", 10.5, 44, "NEUTRA", "aliquota18", "normal", {}, "28"),
        ("fluoxetina", 11.5, 45, "NEUTRA", "aliquota17", "normal", {}, "30"),
        ("sertralina", 12.5, 43, "NEGATIVA", "aliquota12", "normal", {}, "30"),
        ("neosaldina", 8.2, 52, "NEUTRA", "aliquota18", "normal OTC", {}, "20"),
        ("dorflex", 7.8, 50, "NEUTRA", "aliquota17", "normal OTC", {}, "36"),
        ("dipirona", 5.1, 62, "NEUTRA", "aliquota18", "normal OTC", {}, "10"),
        ("paracetamol", 5.8, 60, "POSITIVA", "aliquota17", "normal OTC", {}, "20"),
        ("ibuprofeno", 7.2, 55, "NEUTRA", "aliquota18", "normal OTC", {}, "10"),
    ]

    # 4 ST (conveniencia) — reuse dipirona EANs? Better pick unrelated ST-like from soro leftover or invent from energy drinks not in CMED.
    # CMED is medicines only. For ST use products that can be fiscal ST in pharmacy (beverages not in CMED).
    # Use vitamin leftovers flagged ST for fiscal variety on non-controlled meds with aliquota 0 st=S — unusual for meds but OK for import test.
    st_specs = [
        ("vitamina_c", 3.0, 40, "NEUTRA", "st", "ST fiscal teste", {"grupo": "3", "categoria": "2"}, "30"),
        ("vitamina_c", 3.2, 40, "NEUTRA", "st", "ST fiscal teste", {"grupo": "3", "categoria": "2"}, "30"),
        ("soro", 2.2, 40, "NEUTRA", "st", "ST fiscal teste", {"grupo": "3", "categoria": "2"}, "1"),
        ("soro", 2.4, 40, "NEUTRA", "st", "ST fiscal teste", {"grupo": "3", "categoria": "2"}, "1"),
    ]

    # 8 controlados Portaria
    ctrl_specs = [
        ("clonazepam", 15.0, 50, "NEUTRA", "aliquota17", "controlado B1", {}, "30"),
        ("clonazepam", 14.5, 55, "NEUTRA", "aliquota18", "controlado B1", {}, "30"),
        ("alprazolam", 12.0, 50, "NEUTRA", "aliquota17", "controlado B1", {}, "30"),
        ("diazepam", 8.0, 60, "NEUTRA", "aliquota18", "controlado B1", {}, "20"),
        ("zolpidem", 16.0, 45, "NEUTRA", "aliquota17", "controlado", {}, "20"),
        ("morfina", 22.0, 40, "NEUTRA", "isento", "controlado A1", {}, "1"),
        ("metilfenidato", 25.0, 35, "NEUTRA", "aliquota18", "controlado A3", {}, "30"),
        ("alprazolam", 11.5, 52, "POSITIVA", "aliquota17", "controlado B1", {}, "30"),
    ]

    # 6 antibioticos T
    ab_specs = [
        ("amoxicilina", 9.0, 55, "NEUTRA", "aliquota17", "antibiotico T", {}, "21"),
        ("amoxicilina", 9.5, 50, "NEUTRA", "aliquota18", "antibiotico T", {}, "21"),
        ("azitromicina", 11.0, 45, "NEUTRA", "aliquota17", "antibiotico T", {}, "5"),
        ("azitromicina", 10.5, 48, "POSITIVA", "aliquota18", "antibiotico T", {}, "3"),
        ("cefalexina", 8.5, 55, "NEUTRA", "aliquota17", "antibiotico T", {}, "16"),
        ("amoxicilina", 8.8, 52, "NEGATIVA", "aliquota12", "antibiotico T", {}, "14"),
    ]

    rows: list[dict[str, str]] = []
    codigo = 85001

    def add_specs(kind: str, items: list[tuple]) -> None:
        nonlocal codigo
        for pool, custo, markup, pis, fiscal, obs, extra, unidemb in items:
            ean, info = take(pool)
            kwargs = {
                "medfp": False,
                "grupo": "1",
                "categoria": "1",
            }
            kwargs.update(extra)
            rows.append(
                build_row(
                    codigo,
                    ean,
                    info,
                    kind=kind,
                    lista_pis=pis,
                    fiscal=fiscal,
                    grupo=str(kwargs["grupo"]),
                    categoria=str(kwargs["categoria"]),
                    custo=custo,
                    markup=markup,
                    unidemb=unidemb,
                    medfp=bool(kwargs.get("medfp")),
                    observacao=obs,
                    port=port,
                )
            )
            codigo += 1

    add_specs("normal", normal_specs)
    add_specs("normal", st_specs)
    add_specs("controlado", ctrl_specs)
    add_specs("antibiotico", ab_specs)

    assert len(rows) == 50, len(rows)

    # uniqueness
    eans = [r["codigobarras"] for r in rows]
    assert len(eans) == len(set(eans)), "EAN duplicado"

    lines = [";".join(HEADERS)]
    for r in rows:
        lines.append(";".join(r[h] for h in HEADERS))
    OUT.write_text("\n".join(lines) + "\n", encoding="utf-8")

    n_ctrl = sum(1 for r in rows if r["listacontrole"] not in ("", "T"))
    n_ab = sum(1 for r in rows if r["listacontrole"] == "T")
    n_norm = sum(1 for r in rows if r["listacontrole"] == "")
    print(f"Wrote {OUT}")
    print(f"total={len(rows)} normal={n_norm} controlado={n_ctrl} antibiotico_T={n_ab}")
    print(f"unique_eans={len(set(eans))}")


if __name__ == "__main__":
    main()
