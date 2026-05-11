import { create } from "zustand";
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  query,
  setDoc,
  where,
} from "@firebase/firestore";
import { db } from "../../../../lib/firebase/firebase";
import type {
  AdicionarClientePayload,
  Prefeitura,
} from "../../../../lib/hu360";
import { useLogin } from "../../../login/hooks/use-login";
import type { ClienteResult, ClientesProps } from "./types";

export const useClientes = create<ClientesProps>()(() => ({
  listarClientes: async (): Promise<Prefeitura[]> => {
    const snap = await getDocs(collection(db, "clientes"));
    return snap.docs.map((d) => ({
      id: d.id,
      ...(d.data() as Omit<Prefeitura, "id">),
    }));
  },

  listarPrefeituras: async (): Promise<Prefeitura[]> => {
    const q = query(
      collection(db, "clientes"),
      where("tipoCliente", "==", "prefeitura"),
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({
      id: d.id,
      ...(d.data() as Omit<Prefeitura, "id">),
    }));
  },

  adicionarCliente: async (
    payload: AdicionarClientePayload,
  ): Promise<ClienteResult> => {
    const nome = (payload.nome ?? "").trim();
    const uf = (payload.uf ?? "")
      .trim()
      .toUpperCase()
      .replace(/[^A-Z]/g, "")
      .slice(0, 2);

    if (!nome || uf.length !== 2) {
      return { ok: false, message: "Informe o município e a UF com 2 letras." };
    }
    if (!payload.contrato?.numero?.trim()) {
      return {
        ok: false,
        message: "Informe o número do instrumento contratual.",
      };
    }
    if (!payload.contrato?.objeto?.trim()) {
      return { ok: false, message: "Descreva o objeto do contrato." };
    }
    if (!payload.contrato?.vigenciaInicio?.trim()) {
      return {
        ok: false,
        message: "Informe o início da vigência do contrato.",
      };
    }

    const id = crypto.randomUUID();
    const adminId = useLogin.getState().user?.id ?? null;

    const dados: Prefeitura & { adminId: string | null; criadoEm: string } = {
      id,
      adminId,
      criadoEm: new Date().toISOString(),
      nome,
      uf,
      tipoCliente: payload.tipoCliente ?? "prefeitura",
      contrato: {
        numero: payload.contrato.numero!.trim(),
        processo: payload.contrato.processo ?? "",
        modalidade: payload.contrato.modalidade ?? "pregao_eletronico",
        dataAssinatura: payload.contrato.dataAssinatura ?? "",
        vigenciaInicio: payload.contrato.vigenciaInicio!,
        vigenciaFim: payload.contrato.vigenciaFim ?? "",
        objeto: payload.contrato.objeto!.trim(),
        valorMensal: payload.contrato.valorMensal ?? "",
        valorTotal: payload.contrato.valorTotal ?? "",
        indiceReajuste: payload.contrato.indiceReajuste ?? "",
        periodicidadeFaturamento:
          payload.contrato.periodicidadeFaturamento ?? "mensal",
        slaRespostaHoras: payload.contrato.slaRespostaHoras ?? "",
        responsavelContratante: payload.contrato.responsavelContratante ?? "",
        cargoContratante: payload.contrato.cargoContratante ?? "",
        emailContratante: payload.contrato.emailContratante ?? "",
        telefoneContratante: payload.contrato.telefoneContratante ?? "",
        observacoes: payload.contrato.observacoes ?? "",
        status: payload.contrato.status ?? "ativo",
      },
    };

    await setDoc(doc(db, "clientes", id), dados);
    return { ok: true, message: "Cliente cadastrado com sucesso.", id };
  },

  removerCliente: async (id: string): Promise<ClienteResult> => {
    if (!id) return { ok: false, message: "ID inválido." };
    await deleteDoc(doc(db, "clientes", id));
    return { ok: true, message: "Contrato removido com sucesso." };
  },
}));
