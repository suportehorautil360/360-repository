import { X } from "lucide-react";
import { PAINEL_META, type PainelGeralOs } from "./abrir-os-paineis-dados";
import { AbrirOsPainelGeralConteudo } from "./AbrirOsPainelGeralConteudo";

export type { PainelGeralOs };

interface AbrirOsPainelGeralProps {
  painel: PainelGeralOs;
  onFechar: () => void;
}

export function AbrirOsPainelGeral({
  painel,
  onFechar,
}: AbrirOsPainelGeralProps) {
  const meta = PAINEL_META[painel];

  return (
    <div className="aos-painel">
      <div className="aos-painel__head">
        <h3 className="aos-painel__title">
          <span className="aos-painel__title-icon" aria-hidden>
            {meta.icone}
          </span>
          {meta.titulo}
        </h3>
        <button
          type="button"
          className="aos-painel__close"
          onClick={onFechar}
          aria-label="Fechar painel"
        >
          <X size={18} aria-hidden />
        </button>
      </div>

      <AbrirOsPainelGeralConteudo painel={painel} />
    </div>
  );
}
