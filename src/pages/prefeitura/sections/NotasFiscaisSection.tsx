import { useEffect, useMemo, useState } from "react";
import { Check, FileText, Loader2, Search, X } from "lucide-react";
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
  documentoLabel,
  notasFiscaisApi,
  STATUS_LABEL,
  type NotaFiscalCombustivel,
  type NotaFiscalStatus,
} from "../../../lib/api/notas-fiscais";

type Filtro = "todas" | NotaFiscalStatus;

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

function badgeVariant(status: NotaFiscalStatus): "comboio" | "posto" | "local" {
  if (status === "aprovada") return "posto";
  if (status === "rejeitada") return "local";
  return "comboio";
}

export function NotasFiscaisSection({
  prefeituraId,
}: {
  prefeituraId: string;
}) {
  const [rows, setRows] = useState<NotaFiscalCombustivel[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState(false);
  const [aba, setAba] = useState<Filtro>("todas");
  const [busca, setBusca] = useState("");
  const [ocupadoId, setOcupadoId] = useState<string | null>(null);

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

  async function decidir(id: string, status: NotaFiscalStatus) {
    setOcupadoId(id);
    try {
      await notasFiscaisApi.atualizarStatus(id, status);
      setRows((prev) =>
        prev.map((n) => (n.id === id ? { ...n, status } : n)),
      );
    } catch {
      setErro(true);
    } finally {
      setOcupadoId(null);
    }
  }

  const totais = useMemo(() => {
    const total = rows.reduce((s, n) => s + (n.value || 0), 0);
    const aprovadas = rows
      .filter((n) => n.status === "aprovada")
      .reduce((s, n) => s + (n.value || 0), 0);
    const pendentes = rows.filter((n) => n.status === "pendente").length;
    return { total, aprovadas, pendentes };
  }, [rows]);

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return rows.filter((n) => {
      if (aba !== "todas" && n.status !== aba) return false;
      if (!q) return true;
      return [n.number, n.issuerName, n.description, n.accessKey]
        .join(" ")
        .toLowerCase()
        .includes(q);
    });
  }, [rows, aba, busca]);

  return (
    <section className="flex flex-col gap-5 pb-10">
      <header>
        <div className="text-2xl font-semibold text-slate-100">
          Notas Fiscais de Combustível
        </div>
        <div className="mt-1 text-sm text-slate-400">
          PDFs enviados pelos postos para conferência e aprovação.
        </div>
      </header>

      {erro && (
        <div className="rounded-lg border border-amber-400/30 bg-amber-400/10 px-4 py-2 text-sm text-amber-200">
          Não foi possível concluir a operação. Tente novamente.
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Kpi rotulo="Total" valor={fmtBRL(totais.total)} />
        <Kpi rotulo="Aprovadas" valor={fmtBRL(totais.aprovadas)} cor="text-emerald-300" />
        <Kpi
          rotulo="Pendentes"
          valor={String(totais.pendentes)}
          cor="text-amber-300"
        />
      </div>

      <Card>
        <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative w-full sm:max-w-xs">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-500" />
            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar por número, emitente ou chave…"
              className="w-full rounded-full border border-white/10 bg-white/5 py-2 pr-3 pl-9 text-sm text-slate-100 placeholder:text-slate-500 focus:border-[#f97316] focus:outline-none"
            />
          </div>
          <Tabs value={aba} onValueChange={(v) => setAba(v as Filtro)}>
            <TabsList>
              <TabsTrigger value="todas">Todas</TabsTrigger>
              <TabsTrigger value="pendente">Pendentes</TabsTrigger>
              <TabsTrigger value="aprovada">Aprovadas</TabsTrigger>
              <TabsTrigger value="rejeitada">Rejeitadas</TabsTrigger>
            </TabsList>
          </Tabs>
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
                : "Nenhuma nota encontrada com esse filtro."}
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Emitente</TableHead>
                  <TableHead>Documento</TableHead>
                  <TableHead>Valor</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>PDF</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
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
                        {n.parseCompleteness === "parcial" ? " · revisar" : ""}
                      </span>
                    </TableCell>
                    <TableCell className="text-slate-300">
                      {documentoLabel(n.documentType)} nº {n.number || "—"}
                    </TableCell>
                    <TableCell className="font-medium text-orange-300">
                      {fmtBRL(n.value)}
                    </TableCell>
                    <TableCell>
                      <Badge variant={badgeVariant(n.status)}>
                        {STATUS_LABEL[n.status]}
                      </Badge>
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
                    <TableCell className="text-right">
                      {n.status === "pendente" ? (
                        <div className="inline-flex gap-2">
                          <Button
                            type="button"
                            size="sm"
                            disabled={ocupadoId === n.id}
                            onClick={() => decidir(n.id, "aprovada")}
                            className="bg-emerald-600 text-white hover:bg-emerald-600/90"
                          >
                            {ocupadoId === n.id ? (
                              <Loader2 className="size-4 animate-spin" />
                            ) : (
                              <Check className="size-4" />
                            )}
                            Aprovar
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled={ocupadoId === n.id}
                            onClick={() => decidir(n.id, "rejeitada")}
                          >
                            <X className="size-4" /> Rejeitar
                          </Button>
                        </div>
                      ) : (
                        <span className="text-xs text-slate-500">—</span>
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

function Kpi({
  rotulo,
  valor,
  cor,
}: {
  rotulo: string;
  valor: string;
  cor?: string;
}) {
  return (
    <Card className="p-4">
      <div className="text-xs font-medium uppercase tracking-wider text-slate-400">
        {rotulo}
      </div>
      <div className={`mt-1 text-xl font-semibold ${cor ?? "text-slate-100"}`}>
        {valor}
      </div>
    </Card>
  );
}
