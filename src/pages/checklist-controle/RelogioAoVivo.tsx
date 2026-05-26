import { useEffect, useState } from "react";

/** Relógio grande que atualiza a cada segundo (hora local). */
export function RelogioAoVivo() {
  const [agora, setAgora] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setAgora(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="ponto-relogio" role="timer" aria-live="off">
      {agora.toLocaleTimeString("pt-BR")}
    </div>
  );
}
