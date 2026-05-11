import type {
  AdicionarClientePayload,
  Prefeitura,
} from "../../../../lib/hu360";

export interface ClienteResult {
  ok: boolean;
  message: string;
  id?: string;
}

export interface ClientesProps {
  listarClientes: () => Promise<Prefeitura[]>;
  listarPrefeituras: () => Promise<Prefeitura[]>;
  adicionarCliente: (
    payload: AdicionarClientePayload,
  ) => Promise<ClienteResult>;
  removerCliente: (id: string) => Promise<ClienteResult>;
}
