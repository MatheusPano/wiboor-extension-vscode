import { Comment, Paginated, Task } from "./types";

export class WiboorApiError extends Error {
  constructor(message: string, readonly status?: number) {
    super(message);
    this.name = "WiboorApiError";
  }
}

type RequestOpts = {
  method?: string;
  body?: unknown;
  headers?: Record<string, string>;
};

/**
 * Cliente HTTP da API Wiboor.
 *
 * Base URL, API key e userExecutorId são resolvidos de forma preguiçosa (lazy)
 * via callbacks, para sempre refletir a configuração atual (settings +
 * SecretStorage + globalState) sem precisar recriar o cliente.
 */
export class WiboorClient {
  constructor(
    private readonly getBaseUrl: () => string,
    private readonly getApiKey: () => Promise<string | undefined>,
    private readonly getUserExecutorId: () => string | undefined | Promise<string | undefined>
  ) { }

  private async request<T>(path: string, opts: RequestOpts = {}): Promise<T> {
    const baseUrl = this.getBaseUrl().trim();
    if (!baseUrl) {
      throw new WiboorApiError(
        'Base URL não configurada. Defina "wiboor.baseUrl" nas Settings.'
      );
    }

    const apiKey = await this.getApiKey();
    if (!apiKey) {

      throw new WiboorApiError(
        'API key não configurada. Rode o comando "Wiboor: Definir API Key".'
      );
    }

    const url = `${baseUrl.replace(/\/+$/, "")}${path}`;


    let res: Response;
    try {
      res = await fetch(url, {
        method: opts.method ?? "GET",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",

          Authorization: `Bearer ${apiKey}`,

          ...(opts.headers ?? {}),
        },
        body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
      });
    } catch (e) {
      throw new WiboorApiError(
        `Falha de rede ao acessar ${url}: ${e instanceof Error ? e.message : String(e)
        }`
      );
    }

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new WiboorApiError(
        `Erro ${res.status} (${res.statusText}) em ${path}${text ? `: ${text}` : ""
        }`,
        res.status
      );
    }

    if (res.status === 204) {
      return undefined as T;
    }
    return (await res.json()) as T;
  }

  /** Lista as tarefas STARTED/PAUSED do executor configurado. */
  async listTasks(): Promise<Task[]> {
    const params = new URLSearchParams();
    params.append("status[]", "STARTED");
    params.append("status[]", "PAUSED");
    const userExecutorId = await this.getUserExecutorId();
    if (userExecutorId) {
      params.append("userExecutorId", userExecutorId);
    }
    const res = await this.request<Paginated<Task>>(
      `/v1/tasks?${params.toString()}`
    );
    return res.data ?? [];
  }



  addComment(id: string, body: string): Promise<Comment> {
    return this.request<Comment>(
      `/v1/tasks/${encodeURIComponent(id)}/comments`,
      {
        method: "POST",
        body: { body },
      }
    );
  }

  startTask(id: string): Promise<unknown> {
    return this.request(`/v1/tasks/${encodeURIComponent(id)}/start`, {
      method: "POST",
    });
  }

  pauseTask(id: string): Promise<unknown> {
    return this.request(`/v1/tasks/${encodeURIComponent(id)}/pause`, {
      method: "POST",
    });
  }

  finishTask(id: string): Promise<unknown> {
    return this.request(`/v1/tasks/${encodeURIComponent(id)}/end`, {
      method: "POST",
    });
  }
}
