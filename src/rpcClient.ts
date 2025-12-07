import { RpcRequestOptions, TransmissionConfig } from "./types.js";

// Minimal JSON-RPC 2.0 client for Transmission snake_case API
export class TransmissionRpcClient {
  private url: string;
  private username?: string;
  private password?: string;
  private sessionId?: string;

  constructor(config: TransmissionConfig) {
    this.url = `${config.baseUrl.replace(/\/$/, "")}/transmission/rpc`;
    this.username = config.username;
    this.password = config.password;
  }

  async call<T = any>({ method, params = {} }: RpcRequestOptions): Promise<T> {
    const body = {
      jsonrpc: "2.0",
      method,
      params,
      id: Date.now()
    };

    const headers: Record<string, string> = {
      "Content-Type": "application/json"
    };

    if (this.sessionId) {
      headers["X-Transmission-Session-Id"] = this.sessionId;
    }

    if (this.username || this.password) {
      const credentials = `${this.username ?? ""}:${this.password ?? ""}`;
      headers["Authorization"] = "Basic " + Buffer.from(credentials).toString("base64");
    }

    const res = await fetch(this.url, {
      method: "POST",
      headers,
      body: JSON.stringify(body)
    });

    if (res.status === 409) {
      const newSessionId = res.headers.get("x-transmission-session-id");
      if (newSessionId) {
        this.sessionId = newSessionId;
        // Retry once with updated session id
        return this.call({ method, params });
      }
    }

    const json: any = await res.json();
    if (json.error) {
      const message = json.error?.message || "Unknown Transmission RPC error";
      const data = json.error?.data?.errorString;
      throw new Error(data ? `${message}: ${data}` : message);
    }

    return (json.result ?? json.arguments ?? json) as T;
  }
}
