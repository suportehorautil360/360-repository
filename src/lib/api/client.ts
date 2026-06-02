/**
 * Client HTTP fino para a API do backend NestJS (back-360-).
 * Base configuravel por VITE_API_URL; em dev chama direto o backend local.
 */

const BASE_URL =
  (import.meta.env.VITE_API_URL as string | undefined) ??
  (import.meta.env.DEV ? "http://localhost:3000" : "/api");

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: body != null ? { "Content-Type": "application/json" } : undefined,
    body: body != null ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    // Tenta extrair a mensagem padrão do Nest ({ message, statusCode }).
    let message = `Erro ${res.status}`;
    try {
      const data = (await res.json()) as { message?: string | string[] };
      if (data?.message) {
        message = Array.isArray(data.message)
          ? data.message.join(", ")
          : data.message;
      }
    } catch {
      // resposta sem corpo JSON — mantém a mensagem genérica
    }
    throw new ApiError(res.status, message);
  }

  // 204/sem corpo
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export const api = {
  get: <T>(path: string) => request<T>("GET", path),
  post: <T>(path: string, body?: unknown) => request<T>("POST", path, body),
  del: <T>(path: string) => request<T>("DELETE", path),
};
