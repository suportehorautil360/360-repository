import { useEffect, useState } from "react";

/** Relógio grande que atualiza a cada segundo (hora local), com data opcional. */
export function RelogioAoVivo({ comData = false }: { comData?: boolean }) {
  const [agora, setAgora] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setAgora(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="ponto-relogio-wrap">
      <div className="ponto-relogio" role="timer" aria-live="off">
        {agora.toLocaleTimeString("pt-BR")}
      </div>
      {comData && (
        <div className="ponto-relogio-data">
          {agora.toLocaleDateString("pt-BR", {
            weekday: "long",
            day: "2-digit",
            month: "long",
            year: "numeric",
          })}
        </div>
      )}
    </div>
  );
}
