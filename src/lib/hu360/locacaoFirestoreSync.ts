/**
 * Sincroniza empresas terceiras (tomadores) e vínculos por chassi entre o
 * armazenamento local HU360 (`prefeituraModulo`) e o Firestore.
 *
 * - Coleção `empresas_terceiras_locacao`: um documento por empresa (id estável).
 * - Coleção `equipamentos`: campo opcional `empresaTerceiraId` (match por chassi).
 */
import {
  collection,
  deleteDoc,
  deleteField,
  doc,
  getDocs,
  query,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import { db } from "../firebase/firebase";
import { norm, novoIdEquipamento } from "./equipamentos";
import * as storage from "./storage";
import type { EmpresaTerceiraLocacao, EquipamentoCadastro } from "./types";

const COL_EMPRESAS = "empresas_terceiras_locacao";
const COL_EQUIP = "equipamentos";

export function normChassisLocacaoSync(s: string): string {
  return norm(s).replace(/\s+/g, "").toUpperCase();
}

function empresaFromFirestore(
  id: string,
  data: Record<string, unknown>,
): EmpresaTerceiraLocacao {
  return {
    id,
    nome: String(data.nome ?? ""),
    cnpj:
      data.cnpj != null && String(data.cnpj).trim()
        ? String(data.cnpj).trim()
        : undefined,
    contato:
      data.contato != null && String(data.contato).trim()
        ? String(data.contato).trim()
        : undefined,
    observacoes:
      data.observacoes != null && String(data.observacoes).trim()
        ? String(data.observacoes).trim()
        : undefined,
    criadoEm: String(data.criadoEm ?? ""),
  };
}

/** Envia empresas + vínculos locais para o Firestore; remove empresas órfãs no servidor. */
export async function pushLocacaoModuloParaFirestore(
  prefeituraId: string,
): Promise<{ ok: boolean; msg: string }> {
  if (!prefeituraId.trim()) {
    return { ok: false, msg: "Cliente inválido." };
  }
  try {
    const dados = storage.getDadosPrefeitura(prefeituraId);
    const pm = dados.prefeituraModulo ?? {};
    const empresas = pm.empresasTerceirasLocacao ?? [];
    const cadastro = pm.equipamentosCadastro ?? [];
    const localEmpIds = new Set(empresas.map((e) => e.id));

    const qEmp = query(
      collection(db, COL_EMPRESAS),
      where("prefeituraId", "==", prefeituraId),
    );
    const snapEmp = await getDocs(qEmp);
    for (const d of snapEmp.docs) {
      if (!localEmpIds.has(d.id)) {
        await deleteDoc(d.ref);
      }
    }

    for (const em of empresas) {
      await setDoc(
        doc(db, COL_EMPRESAS, em.id),
        {
          prefeituraId,
          nome: em.nome,
          cnpj: em.cnpj ?? "",
          contato: em.contato ?? "",
          observacoes: em.observacoes ?? "",
          criadoEm: em.criadoEm,
        },
        { merge: true },
      );
    }

    const qEq = query(collection(db, COL_EQUIP), where("prefeituraId", "==", prefeituraId));
    const snapEq = await getDocs(qEq);
    const byChassis = new Map<string, string>();
    for (const d of snapEq.docs) {
      const data = d.data() as { chassis?: string };
      const k = normChassisLocacaoSync(String(data.chassis ?? ""));
      if (k) byChassis.set(k, d.id);
    }

    let atualizados = 0;
    for (const eq of cadastro) {
      const k = normChassisLocacaoSync(eq.chassis);
      if (!k) continue;
      const fsId = byChassis.get(k);
      if (!fsId) continue;
      const payload: Record<string, unknown> = {};
      if (eq.empresaTerceiraId?.trim()) {
        payload.empresaTerceiraId = eq.empresaTerceiraId.trim();
      } else {
        payload.empresaTerceiraId = deleteField();
      }
      await updateDoc(doc(db, COL_EQUIP, fsId), payload);
      atualizados++;
    }

    return {
      ok: true,
      msg: `Servidor: ${empresas.length} empresa(s) gravada(s); ${atualizados} equipamento(s) com vínculo atualizado.`,
    };
  } catch (e) {
    const m = e instanceof Error ? e.message : String(e);
    return { ok: false, msg: `Falha ao enviar: ${m}` };
  }
}

/** Lê Firestore e mescla empresas + vínculos por chassi no armazenamento local. */
export async function pullLocacaoModuloDoFirestore(
  prefeituraId: string,
): Promise<{ ok: boolean; msg: string }> {
  if (!prefeituraId.trim()) {
    return { ok: false, msg: "Cliente inválido." };
  }
  try {
    const dados = storage.getDadosPrefeitura(prefeituraId);
    const pm = { ...(dados.prefeituraModulo ?? {}) };

    const qEmp = query(
      collection(db, COL_EMPRESAS),
      where("prefeituraId", "==", prefeituraId),
    );
    const snapEmp = await getDocs(qEmp);
    const empresasFs = snapEmp.docs.map((d) =>
      empresaFromFirestore(d.id, d.data() as Record<string, unknown>),
    );
    empresasFs.sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
    const empIds = new Set(empresasFs.map((e) => e.id));

    const qEq = query(collection(db, COL_EQUIP), where("prefeituraId", "==", prefeituraId));
    const snapEq = await getDocs(qEq);
    type FsEq = {
      id: string;
      chassis?: string;
      empresaTerceiraId?: string;
      marca?: string;
      modelo?: string;
      descricao?: string;
      linha?: string;
      obra?: string;
      criadoEm?: string;
    };
    const fsEquips: FsEq[] = snapEq.docs.map((d) => ({
      id: d.id,
      ...(d.data() as object),
    })) as FsEq[];

    const fsByChassis = new Map<string, FsEq>();
    for (const fe of fsEquips) {
      const k = normChassisLocacaoSync(String(fe.chassis ?? ""));
      if (k) fsByChassis.set(k, fe);
    }

    let listaEq = [...(pm.equipamentosCadastro ?? [])];
    const chassisPossuidos = new Set(
      listaEq.map((e) => normChassisLocacaoSync(e.chassis)).filter(Boolean),
    );

    listaEq = listaEq.map((e) => {
      const k = normChassisLocacaoSync(e.chassis);
      if (!k) return e;
      const fe = fsByChassis.get(k);
      if (!fe) return e;
      const next = fe.empresaTerceiraId?.trim() || undefined;
      if (e.empresaTerceiraId === next) return e;
      return { ...e, empresaTerceiraId: next };
    });

    for (const fe of fsEquips) {
      const k = normChassisLocacaoSync(String(fe.chassis ?? ""));
      if (!k || chassisPossuidos.has(k)) continue;
      const criado =
        typeof fe.criadoEm === "string" && fe.criadoEm
          ? fe.criadoEm.slice(0, 16).replace("T", " ")
          : new Date().toISOString().slice(0, 16).replace("T", " ");
      const row: EquipamentoCadastro = {
        id: novoIdEquipamento(prefeituraId),
        marca: String(fe.marca ?? "—"),
        modelo: String(fe.modelo ?? ""),
        chassis: String(fe.chassis ?? "").trim(),
        descricao: String(fe.descricao ?? ""),
        linha: String(fe.linha ?? ""),
        obra: fe.obra != null && String(fe.obra).trim() ? String(fe.obra).trim() : undefined,
        empresaTerceiraId: fe.empresaTerceiraId?.trim() || undefined,
        criadoEm: criado,
      };
      listaEq.push(row);
      chassisPossuidos.add(k);
    }

    listaEq = listaEq.map((e) => {
      if (e.empresaTerceiraId && !empIds.has(e.empresaTerceiraId)) {
        return { ...e, empresaTerceiraId: undefined };
      }
      return e;
    });

    pm.empresasTerceirasLocacao = empresasFs;
    pm.equipamentosCadastro = listaEq;
    storage.salvarDadosPrefeitura(prefeituraId, { ...dados, prefeituraModulo: pm });

    return {
      ok: true,
      msg: `Local: ${empresasFs.length} empresa(s); ${fsEquips.length} equipamento(s) no servidor considerados.`,
    };
  } catch (e) {
    const m = e instanceof Error ? e.message : String(e);
    return { ok: false, msg: `Falha ao importar: ${m}` };
  }
}

/**
 * 1) Envia empresas e vínculos locais ao Firestore.
 * 2) Reimporta do servidor para alinhar lista local (inclui equipamentos só no Hub).
 */
export async function sincronizarLocacaoComFirestore(
  prefeituraId: string,
): Promise<{ ok: boolean; msg: string }> {
  const push = await pushLocacaoModuloParaFirestore(prefeituraId);
  if (!push.ok) return push;
  const pull = await pullLocacaoModuloDoFirestore(prefeituraId);
  if (!pull.ok) return { ok: false, msg: `${push.msg} ${pull.msg}` };
  return {
    ok: true,
    msg: `${push.msg} ${pull.msg}`,
  };
}
