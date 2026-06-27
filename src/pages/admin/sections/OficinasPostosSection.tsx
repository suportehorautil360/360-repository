import { Navigate } from "react-router-dom";

/** Rota legada — redireciona para a aba unificada de parceiros. */
export function OficinasPostosSection() {
  return <Navigate to="/admin/parceiros" replace />;
}
