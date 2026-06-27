import { useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import {
  ArrowLeft,
  Building2,
  Copy,
  ExternalLink,
  Fuel,
  KeyRound,
  Loader2,
  Mail,
  MapPin,
  Trash2,
  UserPlus,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { usePostoDetalhe } from "./posto-detalhe/use-posto-detalhe";

function moeda(v: number): string {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function copiar(texto: string) {
  void navigator.clipboard?.writeText(texto);
}

function iniciais(nome: string, email?: string): string {
  const base = (nome || email || "?").trim();
  const parts = base.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return base.slice(0, 2).toUpperCase();
}

function rotuloAcesso(acesso: { email?: string; usuario: string }): string {
  return acesso.email?.trim() || acesso.usuario;
}

export function PostoDetalhePage() {
  const { postoId } = useParams<{ postoId: string }>();
  const [searchParams] = useSearchParams();
  const prefeituraId = searchParams.get("prefeituraId");

  const {
    titulo,
    detalhe,
    carregando,
    erroCarregamento,
    acessos,
    msg,
    setMsg,
    salvando,
    setSalvando,
    ocupadoId,
    credencialNova,
    setCredencialNova,
    criarAcesso,
    redefinirSenha,
    excluirAcesso,
  } = usePostoDetalhe(postoId);

  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [resetAlvo, setResetAlvo] = useState<{
    id: string;
    rotulo: string;
  } | null>(null);
  const [novaSenha, setNovaSenha] = useState("");
  const [excluirAlvo, setExcluirAlvo] = useState<{
    id: string;
    rotulo: string;
  } | null>(null);

  const voltarHref = prefeituraId
    ? `/admin/parceiros?prefeituraId=${encodeURIComponent(prefeituraId)}`
    : "/admin/parceiros";

  const subtitulo = [detalhe?.cidadeUf, detalhe?.bandeira]
    .filter(Boolean)
    .join(" · ");

  async function handleCriar(e: React.FormEvent) {
    e.preventDefault();
    setSalvando(true);
    setMsg(null);
    setCredencialNova(null);
    const r = await criarAcesso({ nome, email, senha });
    if (r.ok) {
      setNome("");
      setEmail("");
      setSenha("");
      setMsg({ tone: "ok", text: r.message });
    } else {
      setMsg({ tone: "err", text: r.message });
    }
    setSalvando(false);
  }

  async function confirmarReset() {
    if (!resetAlvo || novaSenha.trim().length < 4) return;
    const r = await redefinirSenha(
      resetAlvo.id,
      novaSenha.trim(),
      resetAlvo.rotulo,
    );
    setMsg({
      tone: r.ok ? "ok" : "err",
      text: r.ok
        ? "Senha redefinida. Copie a nova senha no card abaixo."
        : r.message,
    });
    setResetAlvo(null);
    setNovaSenha("");
  }

  async function confirmarExcluir() {
    if (!excluirAlvo) return;
    const r = await excluirAcesso(excluirAlvo.id);
    setMsg({
      tone: r.ok ? "ok" : "err",
      text: r.ok ? "Acesso removido." : r.message,
    });
    setExcluirAlvo(null);
  }

  if (!postoId) {
    return (
      <section className="mx-auto max-w-6xl px-1 py-6">
        <p className="text-red-400">Identificador do posto inválido.</p>
        <Button asChild variant="secondary" className="mt-4">
          <Link to="/admin/parceiros">Voltar</Link>
        </Button>
      </section>
    );
  }

  if (carregando) {
    return (
      <section className="mx-auto flex max-w-6xl items-center justify-center gap-3 px-1 py-24 text-slate-400">
        <Loader2 className="size-5 animate-spin" aria-hidden />
        Carregando posto…
      </section>
    );
  }

  if (erroCarregamento || !detalhe) {
    return (
      <section className="mx-auto max-w-6xl px-1 py-6">
        <p className="text-red-400">{erroCarregamento ?? "Posto não encontrado."}</p>
        <Button asChild variant="secondary" className="mt-4">
          <Link to={voltarHref}>Voltar aos parceiros</Link>
        </Button>
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-6xl space-y-6 px-1 pb-10">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-3">
          <Button
            asChild
            variant="secondary"
            size="sm"
            className="border-white/10 bg-white/[0.04] text-slate-300 hover:bg-white/[0.08]"
          >
            <Link to={voltarHref}>
              <ArrowLeft className="size-4" aria-hidden />
              Postos e oficinas
            </Link>
          </Button>

          <div className="flex flex-wrap items-center gap-3">
            <div className="grid size-12 place-items-center rounded-2xl bg-orange-500/15 text-orange-400">
              <Fuel size={24} aria-hidden />
            </div>
            <div>
              <h2 className="text-2xl font-semibold tracking-tight text-slate-50">
                {titulo}
              </h2>
              {subtitulo ? (
                <p className="mt-0.5 flex items-center gap-1.5 text-sm text-slate-400">
                  <MapPin className="size-3.5 shrink-0" aria-hidden />
                  {subtitulo}
                </p>
              ) : null}
            </div>
            <Badge variant={detalhe.ativo !== false ? "posto" : "local"}>
              {detalhe.ativo !== false ? "Ativo" : "Suspenso"}
            </Badge>
          </div>
        </div>

        <Button
          asChild
          variant="secondary"
          className="border-white/10 bg-white/[0.04] text-slate-200"
        >
          <a
            href="/login-operacional?destino=posto"
            target="_blank"
            rel="noopener noreferrer"
          >
            <ExternalLink className="size-4" aria-hidden />
            Portal do posto
          </a>
        </Button>
      </div>

      {credencialNova ? (
        <Card className="border-emerald-400/30 bg-emerald-500/10">
          <CardHeader className="pb-2">
            <CardTitle className="text-emerald-200">
              Credenciais geradas — copie agora
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <CredencialItem rotulo="Operador" valor={credencialNova.nome} />
            {credencialNova.email ? (
              <CredencialItem rotulo="E-mail de acesso" valor={credencialNova.email} />
            ) : null}
            <CredencialItem rotulo="Senha" valor={credencialNova.senha} />
            <p className="text-xs leading-relaxed text-emerald-200/80">
              A senha não fica visível depois de salva. O operador entra no
              portal com o e-mail e esta senha.
            </p>
          </CardContent>
        </Card>
      ) : null}

      {msg ? (
        <p
          role="status"
          className={cn(
            "rounded-xl border px-4 py-3 text-sm",
            msg.tone === "ok"
              ? "border-emerald-400/30 bg-emerald-500/10 text-emerald-200"
              : "border-red-400/30 bg-red-500/10 text-red-200",
          )}
        >
          {msg.text}
        </p>
      ) : null}

      <Tabs defaultValue="dados" className="gap-6">
        <TabsList>
          <TabsTrigger value="dados">
            <Building2 className="size-4" aria-hidden />
            Dados do posto
          </TabsTrigger>
          <TabsTrigger value="acessos">
            <KeyRound className="size-4" aria-hidden />
            Acessos ({acessos.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="dados" className="mt-0">
          <div className="grid gap-4 lg:grid-cols-2">
            <InfoCard titulo="Identificação">
              <InfoRow rotulo="Razão social" valor={detalhe.razaoSocial} />
              <InfoRow rotulo="Nome fantasia" valor={detalhe.nomeFantasia} />
              <InfoRow rotulo="CNPJ" valor={detalhe.cnpj} />
              <InfoRow rotulo="Bandeira" valor={detalhe.bandeira} />
            </InfoCard>

            <InfoCard titulo="Contato e local">
              <InfoRow rotulo="Telefone" valor={detalhe.telefonePrincipal} />
              <InfoRow rotulo="E-mail comercial" valor={detalhe.emailComercial} />
              <InfoRow rotulo="Endereço" valor={detalhe.endereco} />
              <InfoRow rotulo="Cidade / UF" valor={detalhe.cidadeUf} />
            </InfoCard>

            <InfoCard titulo="Operação">
              <InfoChips rotulo="Combustíveis" itens={detalhe.combustiveis} />
              <InfoChips rotulo="Serviços" itens={detalhe.servicos} />
            </InfoCard>

            <InfoCard titulo="Financeiro">
              <InfoRow rotulo="Condição" valor={detalhe.condicaoPagamento} />
              <InfoRow
                rotulo="Limite de crédito"
                valor={
                  detalhe.limiteCredito
                    ? moeda(detalhe.limiteCredito)
                    : undefined
                }
              />
              <InfoRow rotulo="Desconto" valor={detalhe.descontoComercial} />
              <InfoRow
                rotulo="Observações"
                valor={detalhe.observacoesFaturamento}
              />
            </InfoCard>
          </div>
        </TabsContent>

        <TabsContent value="acessos" className="mt-0">
          <div className="grid gap-6 lg:grid-cols-5">
            <Card className="lg:col-span-3">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <KeyRound className="size-4 text-orange-400" aria-hidden />
                  Equipe com acesso
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="mb-4 text-sm leading-relaxed text-slate-400">
                  Cada operador entra no portal do posto com{" "}
                  <strong className="font-medium text-slate-200">e-mail</strong>{" "}
                  e senha. A senha só aparece aqui na criação ou ao redefinir.
                </p>

                {acessos.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-white/10 bg-white/[0.02] px-6 py-10 text-center">
                    <Mail className="mx-auto mb-3 size-8 text-slate-500" aria-hidden />
                    <p className="text-sm text-slate-400">
                      Nenhum operador cadastrado ainda.
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      Use o formulário ao lado para convidar o primeiro acesso.
                    </p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Operador</TableHead>
                        <TableHead>E-mail de acesso</TableHead>
                        <TableHead className="text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {acessos.map((a) => {
                        const rotulo = rotuloAcesso(a);
                        return (
                          <TableRow key={a.id}>
                            <TableCell>
                              <div className="flex items-center gap-3">
                                <span className="grid size-9 place-items-center rounded-full bg-orange-500/15 text-xs font-bold text-orange-300">
                                  {iniciais(a.nome, rotulo)}
                                </span>
                                <span className="font-medium text-slate-100">
                                  {a.nome}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell className="text-slate-300">
                              {rotulo}
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-2">
                                <Button
                                  type="button"
                                  size="xs"
                                  variant="secondary"
                                  disabled={ocupadoId === a.id}
                                  onClick={() => {
                                    setNovaSenha("");
                                    setResetAlvo({ id: a.id, rotulo });
                                  }}
                                >
                                  Redefinir senha
                                </Button>
                                <Button
                                  type="button"
                                  size="xs"
                                  variant="destructive"
                                  disabled={ocupadoId === a.id}
                                  onClick={() =>
                                    setExcluirAlvo({ id: a.id, rotulo })
                                  }
                                >
                                  <Trash2 className="size-3.5" aria-hidden />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>

            <Card className="border-orange-500/20 bg-orange-500/[0.04] lg:col-span-2 lg:self-start">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <UserPlus className="size-4 text-orange-400" aria-hidden />
                  Novo operador
                </CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleCriar} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="posto-nome">Nome completo</Label>
                    <Input
                      id="posto-nome"
                      value={nome}
                      onChange={(e) => setNome(e.target.value)}
                      placeholder="Ex.: Maria Silva"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="posto-email">E-mail de acesso</Label>
                    <Input
                      id="posto-email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="operador@posto.com.br"
                      autoComplete="email"
                      required
                    />
                    <p className="text-xs text-slate-500">
                      Usado para login e recuperação de senha no portal do posto.
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="posto-senha">Senha inicial</Label>
                    <Input
                      id="posto-senha"
                      type="password"
                      value={senha}
                      onChange={(e) => setSenha(e.target.value)}
                      placeholder="Mínimo 4 caracteres"
                      autoComplete="new-password"
                      minLength={4}
                      required
                    />
                  </div>
                  <Button
                    type="submit"
                    className="w-full bg-[#f97316] text-black hover:bg-[#f97316]/90"
                    disabled={salvando}
                  >
                    {salvando ? (
                      <>
                        <Loader2 className="size-4 animate-spin" aria-hidden />
                        Criando…
                      </>
                    ) : (
                      "Criar acesso e enviar boas-vindas"
                    )}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      <Dialog
        open={resetAlvo !== null}
        onOpenChange={(open) => !open && setResetAlvo(null)}
      >
        <DialogContent className="border-white/10 bg-[#0e1424] text-slate-100">
          <DialogHeader>
            <DialogTitle>Redefinir senha</DialogTitle>
            <DialogDescription className="text-slate-400">
              Nova senha para <strong>{resetAlvo?.rotulo}</strong>. Ela será
              exibida uma vez após confirmar.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="nova-senha">Nova senha</Label>
            <Input
              id="nova-senha"
              type="password"
              value={novaSenha}
              onChange={(e) => setNovaSenha(e.target.value)}
              minLength={4}
              placeholder="Mínimo 4 caracteres"
            />
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setResetAlvo(null)}>
              Cancelar
            </Button>
            <Button
              onClick={() => void confirmarReset()}
              disabled={novaSenha.trim().length < 4 || ocupadoId !== null}
            >
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={excluirAlvo !== null}
        onOpenChange={(open) => !open && setExcluirAlvo(null)}
      >
        <DialogContent className="border-white/10 bg-[#0e1424] text-slate-100">
          <DialogHeader>
            <DialogTitle>Remover acesso</DialogTitle>
            <DialogDescription className="text-slate-400">
              Remover o acesso de <strong>{excluirAlvo?.rotulo}</strong>? Esta
              ação não pode ser desfeita.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setExcluirAlvo(null)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={() => void confirmarExcluir()}
              disabled={ocupadoId !== null}
            >
              Remover
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}

function InfoCard({
  titulo,
  children,
}: {
  titulo: string;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm uppercase tracking-wider text-slate-400">
          {titulo}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">{children}</CardContent>
    </Card>
  );
}

function InfoRow({ rotulo, valor }: { rotulo: string; valor?: string }) {
  if (!valor?.trim()) return null;
  return (
    <div className="flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
      <span className="text-sm text-slate-500">{rotulo}</span>
      <span className="text-sm font-medium text-slate-100 sm:text-right">
        {valor}
      </span>
    </div>
  );
}

function InfoChips({ rotulo, itens }: { rotulo: string; itens?: string[] }) {
  if (!itens?.length) return null;
  return (
    <div className="space-y-2">
      <span className="text-sm text-slate-500">{rotulo}</span>
      <div className="flex flex-wrap gap-1.5">
        {itens.map((item) => (
          <Badge key={item} variant="local" className="font-normal">
            {item}
          </Badge>
        ))}
      </div>
    </div>
  );
}

function CredencialItem({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-black/20 px-3 py-2">
      <span className="text-xs uppercase tracking-wide text-emerald-200/70">
        {rotulo}
      </span>
      <span className="flex items-center gap-2">
        <code className="text-sm text-emerald-100">{valor}</code>
        <Button
          type="button"
          size="xs"
          variant="secondary"
          onClick={() => copiar(valor)}
          aria-label={`Copiar ${rotulo}`}
        >
          <Copy className="size-3.5" aria-hidden />
        </Button>
      </span>
    </div>
  );
}
