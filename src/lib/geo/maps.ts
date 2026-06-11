/** Localização ("lat, lng") → URL de busca no Google Maps. "" quando vazio. */
export function linkGoogleMaps(gps: string | null | undefined): string {
  const q = (gps ?? "").trim();
  if (!q) return "";
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
}
