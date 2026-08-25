/**
 * Gera índices de controlados a partir de fontes Anvisa:
 *  - Portaria 344 Anexo I (texto de RDC consolidada)
 *  - Antimicrobianos (RDC 471 / IN 244 - lista equivalente à vigente para farmácia)
 *
 * Uso:
 *   python scripts/build_controlado_indexes.py
 */
from __future__ import annotations

import json
import re
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
REF = ROOT / "data" / "reference"
OUT_344 = REF / "portaria344.json"
OUT_AM = REF / "antimicrobianos.json"

RDC_URLS = [
    "https://static.poder360.com.br/2024/11/Anvisa-Lista-sob-Controle-Especial-7-novembro-2024.pdf",
]

LIST_HEADER_RE = re.compile(
    r"LISTA\s*[-–]?\s*(A1|A2|A3|B1|B2|C1|C2|C3|C4|C5|D1|D2|E|F1|F2|F3|F4)\b",
    re.IGNORECASE,
)
NOISE = re.compile(
    r"(sujeitas?|notifica|receita|adendo|anexo|minist|agência|atualiza|lista das|"
    r"entorpec|psicotr|precursor|proscrit|plantas|insumos|http|www\.|dou |"
    r"resolu|rdc |instru|norma|art\.|página|ediç)",
    re.IGNORECASE,
)

PRIORITY = {
    "A1": 100,
    "A2": 95,
    "A3": 90,
    "B1": 80,
    "B2": 75,
    "C1": 60,
    "C2": 55,
    "C3": 50,
    "C4": 45,
    "C5": 40,
}


def normalize_key(name: str) -> str:
    import unicodedata

    t = unicodedata.normalize("NFD", name)
    t = "".join(c for c in t if unicodedata.category(c) != "Mn")
    t = t.upper()
    t = re.sub(r"[^A-Z0-9; ]+", " ", t)
    t = re.sub(r"\s+", " ", t).strip()
    return t


def fetch_text(url: str, timeout: int = 60) -> str:
    req = urllib.request.Request(
        url,
        headers={"User-Agent": "ImportFlow/1.0 (controlado index builder)"},
    )
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        data = resp.read()
    if data[:4] == b"%PDF":
        try:
            from pypdf import PdfReader
            import io

            reader = PdfReader(io.BytesIO(data))
            return "\n".join((p.extract_text() or "") for p in reader.pages)
        except Exception:
            return data.decode("latin-1", errors="ignore")
    return data.decode("utf-8", errors="ignore")


def load_local_fallbacks() -> list[str]:
    texts: list[str] = []
    agent = (
        Path.home()
        / ".cursor"
        / "projects"
        / "c-Users-tools-Projects-ImportFlow"
        / "agent-tools"
    )
    for name in (
        "db257b2d-b55f-4f54-b70a-038482fecc7d.txt",
        "66b04bef-4df4-4ff5-ac87-e4c2e31d613d.txt",
        "04488bf9-4cd1-41ca-a076-8e38c5dce3a1.txt",
    ):
        p = agent / name
        if p.exists():
            texts.append(p.read_text(encoding="utf-8", errors="ignore"))
    return texts


def parse_portaria_lists(text: str) -> dict[str, str]:
    allow = set(PRIORITY)
    parts = LIST_HEADER_RE.split(text)
    result: dict[str, str] = {}
    i = 1
    while i + 1 < len(parts):
        code = parts[i].upper()
        body = parts[i + 1]
        i += 2
        if code not in allow:
            continue
        for line in body.splitlines():
            line = line.strip()
            line = re.sub(r"^\|\s*", "", line)
            line = re.sub(r"\s*\|.*$", "", line).strip()
            m = re.match(r"^(\d{1,3})\.\s*(.+)$", line)
            if m:
                name = m.group(2).strip()
            else:
                if not re.match(r"^[A-Za-zÀ-ÿ]", line):
                    continue
                name = line
            if NOISE.search(name) or len(name) < 3 or len(name) > 80:
                continue
            name = re.split(r"\s{2,}|\(|–|- sujeit", name)[0].strip(" .;,-")
            if not name or NOISE.search(name):
                continue
            key = normalize_key(name)
            if len(key) < 3:
                continue
            prev = result.get(key)
            if prev is None or PRIORITY.get(code, 0) > PRIORITY.get(prev, 0):
                result[key] = code
    return result


# Lista IN 244/2023 (revogada pela IN 360/2025, mas conteúdo equivalente para farmácia)
IN244_ANTIMICROBIANOS = """
ácido clavulânico
ácido fusídico
ácido nalidíxico
ácido oxolínico
ácido pipemídico
amicacina
amoxicilina
ampicilina
axetilcefuroxima
azitromicina
aztreonam
bacitracina
besifloxacino
brodimoprima
capreomicina
carbenicilina
cefaclor
cefadroxil
cefalexina
cefalotina
cefazolina
cefepima
cefodizima
cefoperazona
cefotaxima
cefoxitina
cefpodoxima
cefpiroma
cefprozil
ceftadizima
ceftarolina fosamila
ceftobiprol
ceftriaxona
cefuroxima
ciprofloxacina
claritromicina
clindamicina
clofazimina
clorfenesina
cloranfenicol
cloxacilina
dactinomicina
daptomicina
dapsona
delamanide
dicloxacilina
difenilsulfona
diidroestreptomicina
diritromicina
doripenem
doxiciclina
eritromicina
ertapenem
espectinomicina
espiramicina
estreptomicina
etambutol
etionamida
fosfomicina
ftalilsulfatiazol
gatifloxacina
gemifloxacino
gentamicina
gramicidina
imipenem
isoniazida
levofloxacina
levofloxacino
linezolida
limeciclina
lincomicina
lomefloxacina
loracarbef
mandelamina
meropenem
metampicilina
metronidazol
minociclina
miocamicina
mitomicina
moxifloxacino
mupirocina
neomicina
netilmicina
nitrofural
nitrofurantoína
nitroxolina
norfloxacina
ofloxacina
oxacilina
oxitetraciclina
pefloxacina
penicilina G
penicilina V
piperacilina
pirazinamida
polimixina B
pristinamicina
protionamida
retapamulina
rifabutina
rifamicina
rifampicina
rifapentina
rosoxacina
roxitromicina
sulbactam
sulfacetamida
sulfadiazina
sulfadoxina
sulfaguanidina
sulfamerazina
sulfanilamida
sulfametizol
sulfametoxazol
sulfametoxipiridazina
sulfametoxipirimidina
sulfatiazol
sultamicilina
tazobactam
tedizolida
teicoplanina
telitromicina
tetraciclina
tianfenicol
ticarcilina
tigeciclina
tirotricina
tobramicina
trimetoprima
trovafloxacina
vancomicina
nitazoxanida
""".strip().splitlines()


def merge_synonyms(lists: dict[str, str]) -> dict[str, str]:
    aliases = {
        "FENTANIL": "FENTANILA",
        "ALFENTANIL": "ALFENTANILA",
        "SUFENTANIL": "SUFENTANILA",
        "REMIFENTANIL": "REMIFENTANILA",
        "LEVOFLOXACINA": "LEVOFLOXACINO",
        "CEFEFPIROMA": "CEFPIROMA",
    }
    out = dict(lists)
    for alias, canonical in aliases.items():
        if canonical in out and alias not in out:
            out[alias] = out[canonical]
        if alias in out and canonical not in out:
            out[canonical] = out[alias]
    return out


def main() -> None:
    REF.mkdir(parents=True, exist_ok=True)

    texts = load_local_fallbacks()
    for url in RDC_URLS:
        try:
            print(f"Baixando {url} ...")
            texts.append(fetch_text(url))
        except Exception as e:
            print(f"  falhou: {e}")

    lists: dict[str, str] = {}
    for t in texts:
        for k, v in parse_portaria_lists(t).items():
            if k not in lists or PRIORITY.get(v, 0) > PRIORITY.get(lists[k], 0):
                lists[k] = v

    if OUT_344.exists():
        # Preserve any prior curated pharmacy aliases not in official annex text
        old = json.loads(OUT_344.read_text(encoding="utf-8"))
        # Only merge if old was curated tiny set - skip if already official rebuild
        if (old.get("count") or len(old.get("lists") or {})) < 200:
            for k, v in (old.get("lists") or {}).items():
                lists.setdefault(normalize_key(k), v)

    lists = merge_synonyms(lists)
    by_lista: dict[str, int] = {}
    for v in lists.values():
        by_lista[v] = by_lista.get(v, 0) + 1

    payload_344 = {
        "source": "Portaria SVS/MS 344/1998 Anexo I (RDC Anvisa consolidada)",
        "note": "Gerado por scripts/build_controlado_indexes.py a partir do Anexo I oficial. Listas A1–C5.",
        "count": len(lists),
        "byLista": by_lista,
        "lists": dict(sorted(lists.items())),
    }
    OUT_344.write_text(json.dumps(payload_344, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"OK {OUT_344} - {len(lists)} substâncias {by_lista}")

    am = {normalize_key(x) for x in IN244_ANTIMICROBIANOS if x.strip()}
    # aliases
    am.add("LEVOFLOXACINO")
    am.add("LEVOFLOXACINA")
    payload_am = {
        "source": "RDC 471/2021 + IN 244/2023 (lista antimicrobianos; IN 360/2025 a sucede)",
        "note": "Lista T no ImportFlow (tcAntimicrobiano / tipoclassesngpc).",
        "count": len(am),
        "substances": sorted(am),
    }
    OUT_AM.write_text(json.dumps(payload_am, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"OK {OUT_AM} - {len(am)} antimicrobianos")


if __name__ == "__main__":
    main()
