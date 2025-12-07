import { RpcRequestOptions, TransmissionConfig } from "./types.js";

// Minimal JSON-RPC 2.0 client for Transmission snake_case API
export class TransmissionRpcClient {
  private url: string;
  private username?: string;
  private password?: string;
  private sessionId?: string;
  private preferLegacy = false;

  constructor(config: TransmissionConfig) {
    this.url = `${config.baseUrl.replace(/\/$/, "")}/transmission/rpc`;
    this.username = config.username;
    this.password = config.password;
  }

  async call<T = any>({ method, params = {} }: RpcRequestOptions): Promise<T> {
    if (this.preferLegacy) {
      return this.callLegacy<T>(method, params);
    }

    try {
      const result = await this.callJsonRpc<T>(method, params);
      // Transmission may return string "method name not recognized" instead of error.
      if (typeof result === "string" && result.toLowerCase().includes("not recognized")) {
        this.preferLegacy = true;
        return this.callLegacy<T>(method, params);
      }
      return result;
    } catch (error: any) {
      const msg = error?.message?.toLowerCase?.() ?? "";
      if (msg.includes("not recognized")) {
        this.preferLegacy = true;
        return this.callLegacy<T>(method, params);
      }
      throw error;
    }
  }

  private async callJsonRpc<T>(method: string, params: Record<string, any>): Promise<T> {
    const body = {
      jsonrpc: "2.0",
      method,
      params,
      id: Date.now()
    };

    const json = await this.send(body);
    if (json.error) {
      const message = json.error?.message || "Unknown Transmission RPC error";
      const data = json.error?.data?.errorString;
      throw new Error(data ? `${message}: ${data}` : message);
    }

    return (json.result ?? json.arguments ?? json) as T;
  }

  private async callLegacy<T>(method: string, params: Record<string, any>): Promise<T> {
    const legacyMethod = this.toLegacyMethod(method);
    const legacyParams = this.toLegacyParams(params);
    const body = {
      method: legacyMethod,
      arguments: legacyParams
    };

    const json = await this.send(body);
    if (json.result && json.result !== "success") {
      throw new Error(json.result);
    }

    return (json.arguments ?? json) as T;
  }

  private async send(body: any): Promise<any> {
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
        return this.send(body);
      }
    }

    return res.json();
  }

  private toLegacyMethod(method: string): string {
    const map: Record<string, string> = {
      session_get: "session-get",
      session_set: "session-set",
      session_stats: "session-stats",
      torrent_add: "torrent-add",
      torrent_get: "torrent-get",
      torrent_set: "torrent-set",
      torrent_remove: "torrent-remove",
      torrent_set_location: "torrent-set-location",
      torrent_start: "torrent-start",
      torrent_stop: "torrent-stop",
      torrent_verify: "torrent-verify",
      torrent_reannounce: "torrent-reannounce",
      queue_move_top: "queue-move-top",
      queue_move_up: "queue-move-up",
      queue_move_down: "queue-move-down",
      queue_move_bottom: "queue-move-bottom",
      free_space: "free-space"
    };
    return map[method] || method.replace(/_/g, "-");
  }

  private toLegacyParams(params: Record<string, any>): Record<string, any> {
    const converted: Record<string, any> = {};
    for (const [key, value] of Object.entries(params)) {
      if (value === undefined) continue;
      if (Array.isArray(value) && key === "fields") {
        // include both snake_case and camelCase field names for compatibility
        converted.fields = Array.from(new Set([
          ...value,
          ...value.map((f) => this.snakeToCamel(f as string))
        ]));
        continue;
      }
      const legacyKey = key.includes("_") ? key.replace(/_/g, "-") : key;
      converted[legacyKey] = value;
    }
    return converted;
  }

  private snakeToCamel(value: string): string {
    return value.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
  }
}
