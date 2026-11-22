import { SessionDocument, SessionPrivateMeta, AuditLogEvent, NudgeRecord } from "@/types/session";
import { hashSecret } from "./crypto";

// In-memory persistent storage fallback for zero-configuration local runs or testing
class InMemoryStore {
  private sessions = new Map<string, SessionDocument>();
  private slugs = new Map<string, string>(); // slug -> sessionId
  private privateMetas = new Map<string, SessionPrivateMeta>();
  private auditLogs = new Map<string, AuditLogEvent[]>();
  private nudges = new Map<string, NudgeRecord[]>();

  constructor() {
    // Seed an initial demo session if desired for instant manual exploration
  }

  async getSession(sessionId: string): Promise<SessionDocument | null> {
    const session = this.sessions.get(sessionId);
    if (!session) return null;
    return JSON.parse(JSON.stringify(session));
  }

  async getSessionBySlug(slug: string): Promise<SessionDocument | null> {
    const sessionId = this.slugs.get(slug);
    if (!sessionId) {
      // Also try direct sessionId lookup or matching by prefix
      for (const [id, s] of this.sessions.entries()) {
        if (s.slug === slug || id === slug) {
          return JSON.parse(JSON.stringify(s));
        }
      }
      return null;
    }
    return this.getSession(sessionId);
  }

  async createSession(session: SessionDocument, meta: SessionPrivateMeta): Promise<void> {
    this.sessions.set(session.sessionId, JSON.parse(JSON.stringify(session)));
    this.slugs.set(session.slug, session.sessionId);
    this.privateMetas.set(session.sessionId, JSON.parse(JSON.stringify(meta)));
    this.auditLogs.set(session.sessionId, []);
    this.nudges.set(session.sessionId, []);
  }

  async updateSession(
    sessionId: string,
    updater: (current: SessionDocument) => SessionDocument
  ): Promise<SessionDocument> {
    const current = this.sessions.get(sessionId);
    if (!current) throw new Error("Session not found: " + sessionId);
    const updated = updater(JSON.parse(JSON.stringify(current)));
    this.sessions.set(sessionId, JSON.parse(JSON.stringify(updated)));
    if (updated.slug !== current.slug) {
      this.slugs.delete(current.slug);
      this.slugs.set(updated.slug, sessionId);
    }
    return updated;
  }

  async getPrivateMeta(sessionId: string): Promise<SessionPrivateMeta | null> {
    const meta = this.privateMetas.get(sessionId);
    if (!meta) return null;
    return JSON.parse(JSON.stringify(meta));
  }

  async updatePrivateMeta(
    sessionId: string,
    updater: (current: SessionPrivateMeta) => SessionPrivateMeta
  ): Promise<SessionPrivateMeta> {
    const current = this.privateMetas.get(sessionId);
    if (!current) throw new Error("Private meta not found: " + sessionId);
    const updated = updater(JSON.parse(JSON.stringify(current)));
    this.privateMetas.set(sessionId, JSON.parse(JSON.stringify(updated)));
    return updated;
  }

  async addAuditLog(sessionId: string, event: AuditLogEvent): Promise<void> {
    const logs = this.auditLogs.get(sessionId) || [];
    logs.push(event);
    this.auditLogs.set(sessionId, logs);
  }

  async addNudge(sessionId: string, nudge: NudgeRecord): Promise<void> {
    const list = this.nudges.get(sessionId) || [];
    list.push(nudge);
    this.nudges.set(sessionId, list);
  }

  async verifyAdmin(sessionId: string, secretToken: string): Promise<boolean> {
    const meta = await this.getPrivateMeta(sessionId);
    if (!meta || !secretToken) return false;
    const providedHash = hashSecret(secretToken);
    return meta.adminSecretHash === providedHash;
  }
}

// Global singleton in development/production so hot reloads don't wipe data in memory
const globalStore = (global as unknown as { __syncupStore?: InMemoryStore });
export const db = globalStore.__syncupStore || (globalStore.__syncupStore = new InMemoryStore());
