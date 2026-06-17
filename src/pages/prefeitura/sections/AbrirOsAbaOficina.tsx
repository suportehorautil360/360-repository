import { useEffect, useMemo, useState } from "react";
import { clientesApi } from "../../../lib/api/clientes";
import { fmtClassificacao } from "./abrir-os-model";

interface OficinaCredenciada {
  id: string;
  nome: string;
  especialidade: string;
}

const BOXES_POR_LINHA: Record<string, string[]> = {
  amarela: ["Box Amarela 1", "Box Amarela 2", "Baia Amarela A"],
  verde: ["Box Verde 1", "Box Verde 2"],
  branca: ["Box Branca 1", "Box Branca 2"],
  leve: ["Box Leve 1", "Box Leve 2"],
  geral: ["Box Geral 1", "Box Geral 2"],
  pesada: ["Box Pesada 1", "Box Pesada 2"],
};

function normEsp(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function linhaCompat(equipLine: string, oficinaEsp: string): boolean {
  const a = normEsp(equipLine);
  const b = normEsp(oficinaEsp);
  if (!a || !b) return false;
  return a === b || a.includes(b) || b.includes(a);
}

function chaveLinha(linha: string): string {
  const n = normEsp(linha);
  if (n.includes("amarela")) return "amarela";
  if (n.includes("verde")) return "verde";
  if (n.includes("branca")) return "branca";
  if (n.includes("leve")) return "leve";
  if (n.includes("pesada")) return "pesada";
  return "geral";
}

interface AbrirOsAbaOficinaProps {
  prefeituraId: string;
  linhaEquipamento: string;
}

export function AbrirOsAbaOficina({
  prefeituraId,
  linhaEquipamento,
}: AbrirOsAbaOficinaProps) {
  const [oficinas, setOficinas] = useState<OficinaCredenciada[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [oficinaId, setOficinaId] = useState("");
  const [boxBaia, setBoxBaia] = useState("");

  const linhaFmt = linhaEquipamento.trim()
    ? fmtClassificacao(linhaEquipamento)
    : "";

  useEffect(() => {
    if (!prefeituraId) return;
    let vivo = true;
    setCarregando(true);
    clientesApi
      .listarOficinasCredenciadas(prefeituraId)
      .then((lista) => {
        if (!vivo) return;
        setOficinas(
          lista
            .filter((o) => o.status === "Ativa")
            .map((o) => ({
              id: o.id,
              nome: o.nome,
              especialidade: o.especialidade,
            })),
        );
      })
      .catch(() => {
        if (vivo) setOficinas([]);
      })
      .finally(() => {
        if (vivo) setCarregando(false);
      });
    return () => {
      vivo = false;
    };
  }, [prefeituraId]);

  const oficinasDaLinha = useMemo(() => {
    if (!linhaEquipamento.trim()) return oficinas;
    const matches = oficinas.filter((o) =>
      linhaCompat(linhaEquipamento, o.especialidade),
    );
    return matches.length > 0 ? matches : oficinas;
  }, [oficinas, linhaEquipamento]);

  const boxes = useMemo(() => {
    const chave = chaveLinha(linhaEquipamento);
    return BOXES_POR_LINHA[chave] ?? BOXES_POR_LINHA.geral;
  }, [linhaEquipamento]);

  useEffect(() => {
    if (oficinasDaLinha.length === 0) {
      setOficinaId("");
      return;
    }
    if (!oficinasDaLinha.some((o) => o.id === oficinaId)) {
      setOficinaId(oficinasDaLinha[0].id);
    }
  }, [oficinasDaLinha, oficinaId]);

  useEffect(() => {
    if (boxes.length === 0) {
      setBoxBaia("");
      return;
    }
    if (!boxes.includes(boxBaia)) {
      setBoxBaia(boxes[0]);
    }
  }, [boxes, boxBaia]);

  return (
    <div className="aos-oficina">
      <h2 className="aos-oficina__title">
        <span className="aos-oficina__title-icon" aria-hidden>
          🏭
        </span>
        Direcionamento automático de oficina
      </h2>

      <div className="aos-oficina__grid">
        <div className="aos-field">
          <label>Linha de equipamento</label>
          <input
            type="text"
            readOnly
            value={linhaFmt}
            placeholder="Selecione o bem na aba Geral"
          />
        </div>
        <div className="aos-field">
          <label>Oficina / equipe responsável</label>
          <select
            value={oficinaId}
            onChange={(e) => setOficinaId(e.target.value)}
            disabled={carregando || oficinasDaLinha.length === 0}
          >
            {carregando ? (
              <option value="">Carregando…</option>
            ) : oficinasDaLinha.length === 0 ? (
              <option value="">Nenhuma oficina credenciada</option>
            ) : (
              oficinasDaLinha.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.nome}
                </option>
              ))
            )}
          </select>
        </div>
        <div className="aos-field">
          <label>Box / baia indicada</label>
          <select
            value={boxBaia}
            onChange={(e) => setBoxBaia(e.target.value)}
            disabled={!linhaEquipamento.trim() || boxes.length === 0}
          >
            {boxes.length === 0 ? (
              <option value="">—</option>
            ) : (
              boxes.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))
            )}
          </select>
        </div>
      </div>

      <div className="aos-oficina__regra" role="note">
        <span className="aos-oficina__regra-icon" aria-hidden>
          💡
        </span>
        <p>
          <strong>Regra de negócio:</strong> o fluxo direciona a O.S. com base no
          cadastro estruturado do ativo (Linha Amarela, Verde, Branca ou Leve),
          otimizando a distribuição de ordens para os respectivos líderes de
          box. A seleção aqui é apenas informativa — o sorteio ocorre ao salvar.
        </p>
      </div>
    </div>
  );
}
