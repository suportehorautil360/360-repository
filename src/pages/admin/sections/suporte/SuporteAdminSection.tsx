import { useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SuporteLegendaTipos } from "./suporte-admin-shared";
import { SuportePostosAdminSection } from "../SuportePostosAdminSection";
import { SuporteOficinasAdminSection } from "../SuporteOficinasAdminSection";

type TipoSuporte = "posto" | "oficina";

function parseTipo(raw: string | null): TipoSuporte {
  return raw === "oficina" ? "oficina" : "posto";
}

export function SuporteAdminSection() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tipo = useMemo(
    () => parseTipo(searchParams.get("tipo")),
    [searchParams],
  );

  function handleTipoChange(value: string) {
    const next = parseTipo(value);
    setSearchParams(next === "posto" ? {} : { tipo: next }, { replace: true });
  }

  return (
    <section className="flex flex-col gap-5 pb-10">
      <header>
        <div className="text-2xl font-semibold text-slate-100">
          Central de Suporte
        </div>
        <p className="mt-1 max-w-3xl text-sm text-slate-400">
          Atenda mensagens dos parceiros. Cada aba mostra um tipo de origem —
          postos de combustível e oficinas mecânicas usam apps diferentes.
        </p>
      </header>

      <SuporteLegendaTipos />

      <Tabs value={tipo} onValueChange={handleTipoChange}>
        <TabsList className="h-auto flex-wrap gap-1">
          <TabsTrigger value="posto" className="gap-2">
            <span aria-hidden>⛽</span>
            Postos de combustível
          </TabsTrigger>
          <TabsTrigger value="oficina" className="gap-2">
            <span aria-hidden>🔧</span>
            Oficinas (app)
          </TabsTrigger>
        </TabsList>

        <TabsContent value="posto" className="mt-4">
          <SuportePostosAdminSection embedded />
        </TabsContent>

        <TabsContent value="oficina" className="mt-4">
          <SuporteOficinasAdminSection embedded />
        </TabsContent>
      </Tabs>
    </section>
  );
}
