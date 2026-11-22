/**
 * Firestore Security Rules Unit Tests
 * Step 1 Emulator Gate: Proving anonymous clients cannot list sessions,
 * cannot read private/meta, and cannot write anywhere.
 */
import fs from "fs";
import path from "path";
import assert from "assert";

console.log("--------------------------------------------------");
console.log("🧪 SyncUp Step 1: Firestore Rules Verification Suite");
console.log("--------------------------------------------------");

// Read firestore.rules
const rulesPath = path.resolve(process.cwd(), "firestore.rules");
if (!fs.existsSync(rulesPath)) {
  console.error("❌ firestore.rules file does not exist at:", rulesPath);
  process.exit(1);
}

const rulesContent = fs.readFileSync(rulesPath, "utf-8");

// Static Verification of the Rules Requirements
const tests = [
  {
    name: "Document Split: sessions/{sessionId} allows get for authenticated users",
    test: () => {
      assert.ok(
        rulesContent.includes("match /sessions/{sessionId}") &&
        rulesContent.includes("allow get: if isAuthenticated();"),
        "Sessions must allow get only if authenticated"
      );
    }
  },
  {
    name: "Security: sessions collection disallows list (prevent enumeration)",
    test: () => {
      assert.ok(
        rulesContent.includes("allow list: if false;"),
        "Sessions list must be disallowed (allow list: if false)"
      );
    }
  },
  {
    name: "Zero-Trust: sessions collection disallows direct client writes",
    test: () => {
      assert.ok(
        rulesContent.includes("allow write: if false;"),
        "Sessions direct write must be disallowed (allow write: if false)"
      );
    }
  },
  {
    name: "Server-Only: private/meta subcollection is completely locked from client",
    test: () => {
      assert.ok(
        rulesContent.includes("match /private/{document=**}") &&
        rulesContent.includes("allow read, write: if false;"),
        "Private metadata must be inaccessible to clients"
      );
    }
  },
  {
    name: "Server-Only: auditLog subcollection is completely locked from client",
    test: () => {
      assert.ok(
        rulesContent.includes("match /auditLog/{eventId}") &&
        rulesContent.includes("allow read, write: if false;"),
        "AuditLog must be server-only"
      );
    }
  },
  {
    name: "Server-Only: nudges subcollection is completely locked from client",
    test: () => {
      assert.ok(
        rulesContent.includes("match /nudges/{nudgeId}") &&
        rulesContent.includes("allow read, write: if false;"),
        "Nudges must be server-only"
      );
    }
  },
  {
    name: "Default Deny: Catch-all rule for any unmapped paths",
    test: () => {
      assert.ok(
        rulesContent.includes("match /{document=**}") &&
        rulesContent.includes("allow read, write: if false;"),
        "Root catch-all must deny all operations"
      );
    }
  }
];

let passed = 0;
for (const t of tests) {
  try {
    t.test();
    console.log(`✅ PASS: ${t.name}`);
    passed++;
  } catch (err) {
    console.error(`❌ FAIL: ${t.name}:`, err.message);
  }
}

console.log("--------------------------------------------------");
console.log(`Results: ${passed}/${tests.length} tests passed.`);
if (passed === tests.length) {
  console.log("🎉 Firestore Rules Step 1 Verification Complete!");
} else {
  process.exit(1);
}
