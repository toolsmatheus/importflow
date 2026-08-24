from pathlib import Path
import json

ROOT = Path(__file__).resolve().parents[1]
HEADERS = (
    "codigo;nome;codigogrupo;custo;markup;venda;unidade;fator;listapiscofins;"
    "aliquota;cfop;ncm;cstpiscofins;valorpmc;codigobarras;subgrupo;categoria;"
    "laboratorio;grupodepreco;similar;estoque;descontofixo;comissao;"
    "atualizaestoque;demanda;ativo;st;isento;semincidencia;permitedesconto;"
    "localizacao;usocontinuo;observacao;descontomax;cest;csosn;csticms;"
    "medfciapop;qtdfciapop;valorfciapop;listacontrole;dcb"
)


def row(codigo: str, nome: str, ean: str, custo: str, markup: str, observacao: str = "") -> str:
    custo_f = float(custo.replace(",", "."))
    mk = float(markup.replace(",", "."))
    venda = f"{custo_f * (1 + mk / 100):.2f}".replace(".", ",")
    cols = [
        codigo,
        nome,
        "1",
        custo,
        markup,
        venda,
        "UN",
        "1",
        "NEUTRA",
        "18",
        "5405",
        "30049099",
        "01",
        "",
        ean,
        "1",
        "1",
        "1",
        "1",
        "",
        "20",
        "0",
        "2",
        "S",
        "5",
        "A",
        "N",
        "N",
        "N",
        "S",
        "",
        "N",
        observacao,
        "10",
        "",
        "102",
        "",
        "N",
        "",
        "",
        "",
        "",
    ]
    return ";".join(cols)


def main() -> None:
    index = json.loads((ROOT / "data/reference/cmed-ean-index.json").read_text(encoding="utf-8"))
    dip_ean = None
    dip_nome = "Dipirona"
    for ean, meta in index["byEan"].items():
        if "DIPIRONA" in meta["s"].upper() and "CAFEINA" not in meta["s"].upper():
            dip_ean = ean
            dip_nome = meta["p"] or "Dipirona"
            break
    if not dip_ean:
        raise SystemExit("EAN de dipirona nao encontrado na CMED")

    # listacontrole/dcb vazios de proposito para testar a sugestao
    products = [
        row("90001", "Reconter (escitalopram) teste", "7896094207592", "28,50", "60,00", "esperado C1"),
        row("90002", "Clonazepam teste", "7891317008932", "12,00", "70,00", "esperado B1"),
        row("90003", "Zolpidem teste", "7891317004606", "35,00", "55,00", "esperado B1"),
        row("90004", "Verotina (fluoxetina) teste", "7896094200494", "18,90", "65,00", "esperado C1"),
        row("90005", "Sertralina teste", "7891317446031", "22,00", "60,00", "esperado C1"),
        row("90006", "Alprazolam teste", "7891317462031", "15,40", "70,00", "esperado B1"),
        row("90007", "Jolik (pregabalina) teste", "7896094211728", "42,00", "50,00", "esperado C1"),
        row("90008", "Dimorf (morfina) teste", "7896676402087", "55,00", "45,00", "esperado A1"),
        row("90009", "Metilfenidato teste", "7891317010263", "48,00", "50,00", "esperado A3"),
        row("90010", "Diazepam teste", "7897406120448", "9,80", "80,00", "esperado B1"),
        row("90011", "Amoxicilina 500mg teste", "7891317001568", "9,00", "55,00", "nao controlado"),
        row("90012", f"{dip_nome} (dipirona) teste", dip_ean, "4,50", "100,00", "nao controlado"),
    ]

    out = ROOT / "data/produtos-controlados-teste.csv"
    out.write_text(HEADERS + "\n" + "\n".join(products) + "\n", encoding="utf-8")
    print(f"OK {out} ({len(products)} produtos)")

    dcb_path = ROOT / "data/dcb.csv"
    names = [
        (1, "Dipirona"),
        (2, "Amoxicilina"),
        (3, "Escitalopram"),
        (4, "Clonazepam"),
        (5, "Zolpidem"),
        (6, "Fluoxetina"),
        (7, "Sertralina"),
        (8, "Alprazolam"),
        (9, "Pregabalina"),
        (10, "Morfina"),
        (11, "Metilfenidato"),
        (12, "Diazepam"),
    ]
    dcb_path.write_text("id;nome\n" + "\n".join(f"{i};{n}" for i, n in names) + "\n", encoding="utf-8")
    print(f"OK {dcb_path}")


if __name__ == "__main__":
    main()
