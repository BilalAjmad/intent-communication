import { ServerResponse } from "node:http";

export interface SSEClient {
  response: ServerResponse;
  sceneId: string;
  lastEventId: number;
}

/** One entry in the SSE ring (trd 11.4). `sceneId` null = project-wide (interview.changed). */
export interface SseEvent {
  seq: number;
  type: string;
  payload: Record<string, unknown>;
  /** Scene the event belongs to, or null for project-wide events replayed to every scene. */
  sceneId: string | null;
}

/**
 * Monotonic event counter + ring of the last 100 events (trd 11.4), plus
 * fan-out to connected SSE clients. `eventLog` is shared by reference with
 * the SSE handler so Last-Event-ID replay sees every broadcast live.
 */
export class SseEventBus {
  private seq = 0;
  readonly eventLog: SseEvent[] = [];
  private static readonly MAX_EVENTS = 100;

  constructor(private readonly clients: Map<string, SSEClient[]>) {}

  /** Record an event in the ring and return its seq (used as the SSE `id`). */
  emit(type: string, payload: Record<string, unknown>, sceneId: string | null = null): number {
    this.seq += 1;
    const seq = this.seq;
    this.eventLog.push({ seq, type, payload, sceneId });
    while (this.eventLog.length > SseEventBus.MAX_EVENTS) {
      this.eventLog.shift();
    }
    return seq;
  }

  /** Write an event to every client of a scene (single event per id).
   *  Clients whose socket throws are reaped so the map cannot grow unbounded. */
  write(sceneId: string, type: string, payload: Record<string, unknown>, seq?: number): void {
    const id = seq ?? this.seq;
    const body = JSON.stringify({ type, ...payload });
    const list = this.clients.get(sceneId);
    if (!list || list.length === 0) return;
    const dead: SSEClient[] = [];
    for (const client of list) {
      try {
        client.response.write(`id: ${id}\n`);
        client.response.write(`data: ${body}\n\n`);
      } catch {
        dead.push(client);
      }
    }
    for (const client of dead) {
      const idx = list.indexOf(client);
      if (idx !== -1) list.splice(idx, 1);
    }
    if (list.length === 0) this.clients.delete(sceneId);
  }

  /** Emit + write to one scene channel. */
  send(sceneId: string, type: string, payload: Record<string, unknown>): void {
    const seq = this.emit(type, payload, sceneId);
    this.write(sceneId, type, payload, seq);
  }

  /** Emit + fan out to every connected scene channel (project-wide events). */
  sendAll(type: string, payload: Record<string, unknown>): void {
    const seq = this.emit(type, payload, null);
    for (const sceneId of [...this.clients.keys()]) {
      this.write(sceneId, type, payload, seq);
    }
  }

  /** Write an event to ONE response without touching the shared ring (fresh
   *  subscriber seed / resync). The id still advances the counter so
   *  Last-Event-ID ordering stays monotonic. */
  writeDirect(res: ServerResponse, type: string, payload: Record<string, unknown>): number {
    this.seq += 1;
    const seq = this.seq;
    try {
      res.write(`id: ${seq}\n`);
      res.write(`data: ${JSON.stringify({ type, ...payload })}\n\n`);
    } catch {
      // Client vanished before the write — nothing to do.
    }
    return seq;
  }
}
