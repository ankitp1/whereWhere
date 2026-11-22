import { SessionDocument, SessionPrivateMeta, AuditLogEvent, NudgeRecord } from "@/types/session";
import { hashSecret } from "./crypto";

export interface ISyncUpDatabase {
  getSession(sessionId: string): Promise<SessionDocument | null>;
  getSessionBySlug(slug: string): Promise<SessionDocument | null>;
  createSession(session: SessionDocument, meta: SessionPrivateMeta): Promise<void>;
  updateSession(
    sessionId: string,
    updater: (current: SessionDocument) => SessionDocument
  ): Promise<SessionDocument>;
  getPrivateMeta(sessionId: string): Promise<SessionPrivateMeta | null>;
  updatePrivateMeta(
    sessionId: string,
    updater: (current: SessionPrivateMeta) => SessionPrivateMeta
  ): Promise<SessionPrivateMeta>;
  addAuditLog(sessionId: string, event: AuditLogEvent): Promise<void>;
  addNudge(sessionId: string, nudge: NudgeRecord): Promise<void>;
  verifyAdmin(sessionId: string, secretToken: string): Promise<boolean>;
}

// In-memory persistent storage fallback for zero-configuration local runs or testing
class InMemoryStore implements ISyncUpDatabase {
  private sessions = new Map<string, SessionDocument>();
  private slugs = new Map<string, string>(); // slug -> sessionId
  private privateMetas = new Map<string, SessionPrivateMeta>();
  private auditLogs = new Map<string, AuditLogEvent[]>();
  private nudges = new Map<string, NudgeRecord[]>();

  async getSession(sessionId: string): Promise<SessionDocument | null> {
    const session = this.sessions.get(sessionId);
    if (!session) return null;
    return JSON.parse(JSON.stringify(session));
  }

  async getSessionBySlug(slug: string): Promise<SessionDocument | null> {
    const sessionId = this.slugs.get(slug);
    if (!sessionId) {
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

// Production Firestore Store (matches Zero-Trust Document Split in Section 2.A)
class FirestoreStore implements ISyncUpDatabase {
  private getDb() {
    // Lazily load firebase-admin
    const admin = require("firebase-admin");
    if (admin.apps.length === 0) {
      if (process.env.FIREBASE_PRIVATE_KEY && process.env.FIREBASE_CLIENT_EMAIL) {
        admin.initializeApp({
          credential: admin.credential.cert({
            projectId: process.env.FIREBASE_PROJECT_ID,
            clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
            privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
          }),
        });
      } else if (process.env.FIREBASE_PROJECT_ID) {
        admin.initializeApp({
          projectId: process.env.FIREBASE_PROJECT_ID,
        });
      } else {
        admin.initializeApp();
      }
    }
    return admin.firestore();
  }

  async getSession(sessionId: string): Promise<SessionDocument | null> {
    const firestore = this.getDb();
    const snap = await firestore.collection("sessions").doc(sessionId).get();
    if (!snap.exists) return null;
    return snap.data() as SessionDocument;
  }

  async getSessionBySlug(slug: string): Promise<SessionDocument | null> {
    const firestore = this.getDb();
    const querySnap = await firestore
      .collection("sessions")
      .where("slug", "==", slug)
      .limit(1)
      .get();
    if (!querySnap.empty) {
      return querySnap.docs[0].data() as SessionDocument;
    }
    // Fallback: check if slug is the direct sessionId
    return this.getSession(slug);
  }

  async createSession(session: SessionDocument, meta: SessionPrivateMeta): Promise<void> {
    const firestore = this.getDb();
    const batch = firestore.batch();

    const sessionRef = firestore.collection("sessions").doc(session.sessionId);
    const metaRef = sessionRef.collection("private").doc("meta");

    batch.set(sessionRef, session);
    batch.set(metaRef, meta);
    await batch.commit();
  }

  async updateSession(
    sessionId: string,
    updater: (current: SessionDocument) => SessionDocument
  ): Promise<SessionDocument> {
    const firestore = this.getDb();
    const sessionRef = firestore.collection("sessions").doc(sessionId);

    return firestore.runTransaction(async (transaction: any) => {
      const snap = await transaction.get(sessionRef);
      if (!snap.exists) {
        throw new Error("Session not found: " + sessionId);
      }
      const current = snap.data() as SessionDocument;
      const updated = updater(JSON.parse(JSON.stringify(current)));
      transaction.set(sessionRef, updated);
      return updated;
    });
  }

  async getPrivateMeta(sessionId: string): Promise<SessionPrivateMeta | null> {
    const firestore = this.getDb();
    const snap = await firestore
      .collection("sessions")
      .doc(sessionId)
      .collection("private")
      .doc("meta")
      .get();
    if (!snap.exists) return null;
    return snap.data() as SessionPrivateMeta;
  }

  async updatePrivateMeta(
    sessionId: string,
    updater: (current: SessionPrivateMeta) => SessionPrivateMeta
  ): Promise<SessionPrivateMeta> {
    const firestore = this.getDb();
    const metaRef = firestore
      .collection("sessions")
      .doc(sessionId)
      .collection("private")
      .doc("meta");

    return firestore.runTransaction(async (transaction: any) => {
      const snap = await transaction.get(metaRef);
      if (!snap.exists) {
        throw new Error("Private meta not found: " + sessionId);
      }
      const current = snap.data() as SessionPrivateMeta;
      const updated = updater(JSON.parse(JSON.stringify(current)));
      transaction.set(metaRef, updated);
      return updated;
    });
  }

  async addAuditLog(sessionId: string, event: AuditLogEvent): Promise<void> {
    const firestore = this.getDb();
    await firestore
      .collection("sessions")
      .doc(sessionId)
      .collection("auditLog")
      .doc(event.id)
      .set(event);
  }

  async addNudge(sessionId: string, nudge: NudgeRecord): Promise<void> {
    const firestore = this.getDb();
    await firestore
      .collection("sessions")
      .doc(sessionId)
      .collection("nudges")
      .doc(nudge.id)
      .set(nudge);
  }

  async verifyAdmin(sessionId: string, secretToken: string): Promise<boolean> {
    const meta = await this.getPrivateMeta(sessionId);
    if (!meta || !secretToken) return false;
    const providedHash = hashSecret(secretToken);
    return meta.adminSecretHash === providedHash;
  }
}

const isFirestoreConfigured = Boolean(
  process.env.FIREBASE_PROJECT_ID ||
  process.env.GOOGLE_APPLICATION_CREDENTIALS ||
  process.env.FIREBASE_CLIENT_EMAIL
);

// Global singleton so hot reloads during development don't wipe data
const globalStore = global as unknown as { __syncupDb?: ISyncUpDatabase };
export const db: ISyncUpDatabase =
  globalStore.__syncupDb ||
  (globalStore.__syncupDb = isFirestoreConfigured ? new FirestoreStore() : new InMemoryStore());
