import { useEffect, useMemo, useState } from "react";
import { Download, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  abastecimentosApi,
  type Abastecimento,
} from "@/lib/api/abastecimentos";
import { baixarCSV } from "@/lib/export/export-utils";
import {
  abastecimentosParaCSV,
  filtrarAbastecimentos,
  type FiltroOrigem,
} from "./abastecimentos-utils";

function fmtData(iso: string): string {
  const [a, m, d] = iso.split("-");
  return d && m && a ? `${d}/${m}` : iso;
}
function fmtNum(n: number): string {
  return (Number(n) || 0).toLocaleString("pt-BR");
}
function fmtValor(r: Abastecimento): string {
  if (r.origem === "comboio") return "—";
  return (Number(r.valor) || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function periodo(rows: Abastecimento[]): string {
  const datas = rows
    .map((r) => r.data)
    .filter(Boolean)
    .sort();
  if (datas.length === 0) return "";
  return `${fmtData(datas[0])} — ${fmtData(datas[datas.length - 1])}`;
}

export function AbastecimentosListSection({
  prefeituraId,
}: {
  prefeituraId: string;
}) {
  const [rows, setRows] = useState<Abastecimento[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState(false);
  const [aba, setAba] = useState<FiltroOrigem>("todas");
  const [busca, setBusca] = useState("");

  useEffect(() => {
    let vivo = true;
    setCarregando(true);
    abastecimentosApi
      .listar(prefeituraId)
      .then((r) => {
        if (vivo) {
          setRows(r);
          setErro(false);
        }
      })
      .catch(() => {
        if (vivo) setErro(true);
      })
      .finally(() => {
        if (vivo) setCarregando(false);
      });
    return () => {
      vivo = false;
    };
  }, [prefeituraId]);

  const filtrados = useMemo(
    () => filtrarAbastecimentos(rows, aba, busca),
    [rows, aba, busca],
  );

  function exportar() {
    baixarCSV("abastecimentos", abastecimentosParaCSV(filtrados));
  }

  return (
    <section className="flex flex-col gap-5 pb-10">
      <header>
        <div className="text-2xl font-semibold text-slate-100">
          Abastecimentos
        </div>
        {!carregando && rows.length > 0 && (
          <div className="mt-1 text-sm text-slate-400">
            Período: {periodo(rows)}
          </div>
        )}
      </header>

      {erro && (
        <div className="rounded-lg border border-amber-400/30 bg-amber-400/10 px-4 py-2 text-sm text-amber-200">
          Não foi possível carregar os abastecimentos. Tente novamente.
        </div>
      )}

      <Card>
        <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative w-full sm:max-w-xs">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-500" />
            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar por placa ou veículo…"
              className="w-full rounded-full border border-white/10 bg-white/5 py-2 pr-3 pl-9 text-sm text-slate-100 placeholder:text-slate-500 focus:border-[#f97316] focus:outline-none"
            />
          </div>
          <Tabs value={aba} onValueChange={(v) => setAba(v as FiltroOrigem)}>
            <TabsList>
              <TabsTrigger value="todas">Todas</TabsTrigger>
              <TabsTrigger value="comboio">Comboio</TabsTrigger>
              <TabsTrigger value="posto">Posto</TabsTrigger>
            </TabsList>
          </Tabs>
          <Button
            type="button"
            onClick={exportar}
            disabled={filtrados.length === 0}
            className="bg-[#c2410c] text-white hover:bg-[#c2410c]/90"
          >
            <Download className="size-4" /> Baixar CSV
          </Button>
        </div>

        <div className="border-t border-white/10">
          {carregando ? (
            <div className="space-y-2 p-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-9 w-full" />
              ))}
            </div>
          ) : filtrados.length === 0 ? (
            <p className="px-4 py-12 text-center text-sm text-slate-500">
              Nenhum abastecimento encontrado.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Veículo</TableHead>
                  <TableHead>Origem</TableHead>
                  <TableHead>Litros</TableHead>
                  <TableHead>Valor</TableHead>
                  <TableHead>Leitura</TableHead>
                  <TableHead>Local</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtrados.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="text-slate-400">
                      {fmtData(r.data)}
                      {r.hora ? (
                        <span className="block text-xs text-slate-500">
                          {r.hora}
                        </span>
                      ) : null}
                    </TableCell>
                    <TableCell>
                      <span className="font-medium text-slate-100">
                        {r.veiculo || "—"}
                      </span>
                      <span className="block text-xs text-slate-500">
                        {[r.placa, r.tipoVeiculo].filter(Boolean).join(" · ")}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge variant={r.origem === "comboio" ? "comboio" : "posto"}>
                        {r.origem === "comboio" ? "Comboio" : "Posto"}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-medium text-amber-200/90">
                      {fmtNum(r.litros)} L
                    </TableCell>
                    <TableCell
                      className={
                        r.origem === "comboio" ? "text-slate-500" : "text-orange-300"
                      }
                    >
                      {fmtValor(r)}
                    </TableCell>
                    <TableCell className="text-slate-400">
                      {fmtNum(r.leitura)} {r.leituraUnidade}
                    </TableCell>
                    <TableCell>
                      <Badge variant="local">{r.local || "—"}</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </Card>
    </section>
  );
}
