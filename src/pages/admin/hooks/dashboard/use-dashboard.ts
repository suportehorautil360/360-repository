import { useCallback, useState } from "react";
import { collection, getDocs } from "@firebase/firestore";
import { db } from "../../../../lib/firebase/firebase";
import type {
  ChecklistFirestore,
  DashboardClienteLinha,
  EquipamentoFirestore,
} from "./types";

export interface UseDashboardFirestore {
  linhas: DashboardClienteLinha[];
  loading: boolean;
  carregar: () => Promise<void>;
}

export function useDashboardFirestore(): UseDashboardFirestore {
  const [linhas, setLinhas] = useState<DashboardClienteLinha[]>([]);
  const [loading, setLoading] = useState(false);

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      const [snapEq, snapCk] = await Promise.all([
        getDocs(collection(db, "equipamentos")),
        getDocs(collection(db, "checklists")),
      ]);

      // Agrupa equipamentos por prefeituraId
      const equipMap = new Map<
        string,
        { ativos: number; manutencao: number }
      >();

      for (const doc of snapEq.docs) {
        const d = { id: doc.id, ...doc.data() } as EquipamentoFirestore;
        const cur = equipMap.get(d.prefeituraId) ?? {
          ativos: 0,
          manutencao: 0,
        };
        const st = (d.status ?? "").toLowerCase();
        if (st === "ativo") cur.ativos += 1;
        if (st === "manutencao" || st === "manutenção") cur.manutencao += 1;
        equipMap.set(d.prefeituraId, cur);
      }

      // Agrupa checklists por prefeituraId
      const ckMap = new Map<string, number>();
      for (const doc of snapCk.docs) {
        const d = { id: doc.id, ...doc.data() } as ChecklistFirestore;
        ckMap.set(d.prefeituraId, (ckMap.get(d.prefeituraId) ?? 0) + 1);
      }

      // Une todos os prefeituraIds conhecidos
      const ids = new Set([...equipMap.keys(), ...ckMap.keys()]);
      const resultado: DashboardClienteLinha[] = Array.from(ids).map((pid) => {
        const eq = equipMap.get(pid) ?? { ativos: 0, manutencao: 0 };
        return {
          prefeituraId: pid,
          ativos: eq.ativos,
          emManutencao: eq.manutencao,
          checklists: ckMap.get(pid) ?? 0,
        };
      });

      setLinhas(resultado);
    } finally {
      setLoading(false);
    }
  }, []);

  return { linhas, loading, carregar };
}
