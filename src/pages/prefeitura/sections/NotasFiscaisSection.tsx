import { useEffect, useMemo, useState } from "react";
import { FileText, Search } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  documentoLabel,
  notasFiscaisApi,
  type NotaFiscalCombustivel,
} from "../../../lib/api/notas-fiscais";

function fmtData(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("pt-BR");
}

function fmtBRL(n: number): string {
  return (Number(n) || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

export function NotasFiscaisSection({
  prefeituraId,
}: {
  prefeituraId: string;
}) {
  const [rows, setRows] = useState<NotaFiscalCombustivel[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState(false);
  const [busca, setBusca] = useState("");

  useEffect(() => {
    let vivo = true;
    setCarregando(true);
    notasFiscaisApi
      .listarCombustivel(prefeituraId)
      .then((data) => {
        if (!vivo) return;
        setRows(data);
        setErro(false);
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

  const total = useMemo(
    () => rows.reduce((s, n) => s + (n.value || 0), 0),
    [rows],
  );

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((n) =>
      [n.number, n.issuerName, n.description, n.accessKey]
        .join(" ")
        .toLowerCase()
        .includes(q),
    );
  }, [rows, busca]);

  return (
    <section className="flex flex-col gap-5 pb-10">
      <header>
        <div className="text-2xl font-semibold text-slate-100">
          Notas Fiscais de Combustível
        </div>
        <div className="mt-1 text-sm text-slate-400">
          PDFs enviados pelos postos credenciados — consulta e visualização.
        </div>
      </header>

      {erro && (
        <div className="rounded-lg border border-amber-400/30 bg-amber-400/10 px-4 py-2 text-sm text-amber-200">
          Não foi possível carregar as notas fiscais. Tente novamente.
        </div>
      )}

      <Kpi rotulo="Total" valor={fmtBRL(total)} />

      <Card>
        <div className="p-4">
          <div className="relative w-full sm:max-w-xs">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-500" />
            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar por número, emitente ou chave…"
              className="w-full rounded-full border border-white/10 bg-white/5 py-2 pr-3 pl-9 text-sm text-slate-100 placeholder:text-slate-500 focus:border-[#f97316] focus:outline-none"
            />
          </div>
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
              {rows.length === 0
                ? "Nenhuma nota fiscal enviada pelos postos ainda."
                : "Nenhuma nota encontrada com essa busca."}
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Emitente</TableHead>
                  <TableHead>Documento</TableHead>
                  <TableHead>Valor</TableHead>
                  <TableHead>PDF</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtrados.map((n) => (
                  <TableRow key={n.id}>
                    <TableCell className="text-slate-400">
                      {fmtData(n.issuedAt || n.createdAt)}
                    </TableCell>
                    <TableCell>
                      <span className="font-medium text-slate-100">
                        {n.issuerName || "Emitente não identificado"}
                      </span>
                      <span className="block text-xs text-slate-500">
                        {n.description || "Combustível"}
                      </span>
                    </TableCell>
                    <TableCell className="text-slate-300">
                      {documentoLabel(n.documentType)} nº {n.number || "—"}
                    </TableCell>
                    <TableCell className="font-medium text-orange-300">
                      {fmtBRL(n.value)}
                    </TableCell>
                    <TableCell>
                      {n.fileUrl ? (
                        <a
                          href={n.fileUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-sm text-orange-300 hover:underline"
                        >
                          <FileText className="size-4" /> Ver
                        </a>
                      ) : (
                        <span className="text-slate-500">—</span>
                      )}
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

function Kpi({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <Card className="p-4">
      <div className="text-xs font-medium uppercase tracking-wider text-slate-400">
        {rotulo}
      </div>
      <div className="mt-1 text-xl font-semibold text-slate-100">{valor}</div>
    </Card>
  );
}
