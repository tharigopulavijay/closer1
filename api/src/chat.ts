import { PolicyError, type Env } from "./env";
import { moderate } from "./moderate";
import { assertChatAccess, deliverMessage, insertAiReport } from "./policy";

const BLOCKS_BEFORE_REPORT = 3;

export class PlanChat implements DurableObject {
  constructor(
    private readonly state: DurableObjectState,
    private readonly env: Env,
  ) {}

  async fetch(request: Request) {
    if (request.headers.get("Upgrade") !== "websocket") {
      return Response.json({ error: "expected websocket" }, { status: 426 });
    }
    const planId = request.headers.get("x-closer-plan") ?? "";
    const userId = request.headers.get("x-closer-user") ?? "";
    try {
      await assertChatAccess(this.env.DB, userId, planId);
    } catch (error) {
      if (error instanceof PolicyError) return Response.json({ error: error.message }, { status: error.status });
      throw error;
    }
    await this.state.storage.put("planId", planId);
    const pair = new WebSocketPair();
    const client = pair[0];
    const server = pair[1];
    this.state.acceptWebSocket(server, [userId]);
    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer) {
    const userId = this.state.getTags(ws)[0] ?? "";
    const planId = (await this.state.storage.get<string>("planId")) ?? "";
    const text = typeof message === "string" ? message : new TextDecoder().decode(message);
    let body = text;
    try {
      const parsed = JSON.parse(text) as { body?: string };
      if (typeof parsed.body === "string") body = parsed.body;
    } catch {
      body = text;
    }
    const verdict = moderate(body);
    if (!verdict.ok) {
      const key = `blocks:${userId}`;
      const count = ((await this.state.storage.get<number>(key)) ?? 0) + 1;
      await this.state.storage.put(key, count);
      if (count === BLOCKS_BEFORE_REPORT) {
        await insertAiReport(this.env.DB, null, userId, "moderation", verdict.reason);
      }
      ws.send(JSON.stringify({ type: "blocked", reason: verdict.reason }));
      return;
    }
    try {
      await deliverMessage(this.env.DB, userId, planId, body);
    } catch (error) {
      const reason = error instanceof PolicyError ? error.message : "error";
      ws.send(JSON.stringify({ type: "error", error: reason }));
      return;
    }
    const payload = JSON.stringify({ type: "message", from: userId, body });
    for (const peer of this.state.getWebSockets()) peer.send(payload);
  }
}
