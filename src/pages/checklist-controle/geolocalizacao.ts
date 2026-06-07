/**
 * Captura da localização (GPS) do dispositivo. Resolve sempre — em erro,
 * devolve `texto: ""` e um `aviso`. Formato do texto: "lat, lng" (6 casas).
 */
export interface GpsResultado {
  texto: string;
  aviso: string;
}

export function obterLocalizacao(): Promise<GpsResultado> {
  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      resolve({
        texto: "",
        aviso: "Geolocalização não suportada neste dispositivo.",
      });
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude, accuracy } = pos.coords;
        resolve({
          texto: `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`,
          aviso:
            accuracy > 100 ? `Precisão baixa (±${Math.round(accuracy)} m).` : "",
        });
      },
      (err) => {
        resolve({
          texto: "",
          aviso:
            err.code === err.PERMISSION_DENIED
              ? "Permissão de localização negada."
              : "Não foi possível obter a localização.",
        });
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
    );
  });
}
