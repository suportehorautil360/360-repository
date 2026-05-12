"""One-off: export HORAUTIL360 Excel to src/data/hu360OperadorSeed.json."""
import json
from datetime import datetime
from pathlib import Path
from typing import Any, Optional

import openpyxl
ROOT = Path(__file__).resolve().parents[1]
XLSX = Path(
    r"c:\Users\Usuário\OneDrive\Desktop\HORAUTIL360_SISTEMA_COMPLETO2_COM_EMERGENCIA.xlsx"
)
OUT = ROOT / "src" / "data" / "hu360OperadorSeed.json"


def rows_to_dicts(ws):
    it = ws.iter_rows(values_only=True)
    header = next(it)
    keys = [str(h).strip() if h is not None else "" for h in header]
    out = []
    for row in it:
        if all(
            v is None or (isinstance(v, str) and str(v).strip() == "") for v in row
        ):
            continue
        d = {}
        for k, v in zip(keys, row):
            if isinstance(v, datetime):
                d[k] = v.isoformat()
            else:
                d[k] = v
        out.append(d)
    return out


def ensure_chassis_cadastro_frota(rows: list[Any]) -> list[Any]:
    """Garante campo Chassis em cada máquina.

    - Se a planilha tiver coluna Chassis, Chassi ou CHASSI com valor, usa esse valor.
    - Caso contrário, gera identificador sintético 17 caracteres (BR + ID sem hífens + zeros),
      alinhado ao app / checklist por chassi.
    """
    for row in rows:
        if not isinstance(row, dict):
            continue
        found: Optional[str] = None
        for key in ("Chassis", "Chassi", "CHASSI"):
            if key not in row or row[key] is None:
                continue
            s = str(row[key]).strip()
            if s:
                found = s
                break
        if found:
            row["Chassis"] = found
            continue
        mid = row.get("ID")
        if mid is None:
            continue
        raw = str(mid).replace("-", "")
        row["Chassis"] = ("BR" + raw + "000000000")[:17]
    return rows


def main():
    OUT.parent.mkdir(parents=True, exist_ok=True)
    wb = openpyxl.load_workbook(XLSX, read_only=True, data_only=True)
    data = {
        "itens_checklist": rows_to_dicts(wb["ITENS_CHECKLIST"]),
        "treinamentos_video": rows_to_dicts(wb["TREINAMENTOS_VIDEO"]),
        "log_emergencias": rows_to_dicts(wb["LOG_EMERGENCIAS"]),
        "ranking_pontuacao": rows_to_dicts(wb["RANKING_PONTUACAO"]),
        "cadastro_frota": rows_to_dicts(wb["CADASTRO_FROTA"]),
        "locacoes_ativas": rows_to_dicts(wb["LOCACOES_ATIVAS"]),
        "cadastro_clientes": rows_to_dicts(wb["CADASTRO_CLIENTES"]),
        "log_respostas": rows_to_dicts(wb["LOG_RESPOSTAS"]),
    }
    wb.close()
    data["cadastro_frota"] = ensure_chassis_cadastro_frota(data["cadastro_frota"])
    OUT.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    print("Wrote", OUT)


if __name__ == "__main__":
    main()
