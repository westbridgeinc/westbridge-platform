/**
 * E2E helpers: create a test session via direct DB seed and clean up after.
 * Uses the same DATABASE_URL as the app (e.g. in CI).
 * Uses pg directly (not Prisma) to avoid ESM/CJS module interop issues with the
 * generated Prisma client when loaded from Playwright's TypeScript transform.
 */

import { createHash, createCipheriv, randomBytes } from "crypto";
import { Client } from "pg";

/**
 * Encrypt a value using the same AES-256-GCM scheme as lib/encryption.ts.
 * Re-implemented here to avoid ESM/CJS import issues with the app's encryption module.
 */
function encryptForTest(plaintext: string): string {
  const secret = process.env.ENCRYPTION_KEY;
  if (!secret || secret.length < 64) throw new Error("ENCRYPTION_KEY must be a 64-char hex string (32 bytes)");
  const key = Buffer.from(secret, "hex");
  const iv = randomBytes(16);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return [iv.toString("hex"), authTag.toString("hex"), encrypted.toString("hex")].join(":");
}

function getDb(): Client {
  return new Client({
    connectionString: process.env.DATABASE_URL ?? "postgresql://localhost:5432/westbridge",
  });
}

const SESSION_EXPIRY_DAYS = 7;

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export type SessionRole = "owner" | "admin" | "member" | "viewer";

export interface TestSession {
  /** Value to set in Cookie: westbridge_sid=<sessionCookie> */
  sessionCookie: string;
  /** Value to set in Cookie: westbridge_csrf=<csrfToken> when calling CSRF-protected endpoints */
  csrfToken?: string;
  userId: string;
  accountId: string;
  role: SessionRole;
  /** Call after test to remove session, user, and account from DB */
  cleanup: () => Promise<void>;
}

/**
 * Create a test user and session in the DB. Call cleanup() after the test.
 */
export async function createTestSession(role: SessionRole): Promise<TestSession> {
  const db = getDb();
  await db.connect();

  try {
    const id = `e2e-${role}-${Date.now()}-${randomBytes(4).toString("hex")}`;
    const email = `${id}@e2e.test`;
    const now = new Date().toISOString();

    // Create account
    const accountRes = await db.query(
      `INSERT INTO accounts (id, email, company_name, plan, status, created_at, updated_at)
       VALUES (gen_random_uuid()::text, $1, 'E2E Test', 'Starter', 'active', $2, $2)
       RETURNING id`,
      [email, now]
    );
    const accountId: string = accountRes.rows[0].id;

    // Create user
    const userRes = await db.query(
      `INSERT INTO users (id, account_id, email, role, status, created_at, updated_at)
       VALUES (gen_random_uuid()::text, $1, $2, $3, 'active', $4, $4)
       RETURNING id`,
      [accountId, email, role, now]
    );
    const userId: string = userRes.rows[0].id;

    // Create session
    const rawToken = randomBytes(32).toString("base64url");
    const tokenHash = hashToken(rawToken);
    const expiresAt = new Date(Date.now() + SESSION_EXPIRY_DAYS * 24 * 60 * 60 * 1000).toISOString();

    // Encrypt the erpnext_sid the same way the app does (AES-256-GCM)
    const encryptedSid = encryptForTest("e2e-erp-sid");
    await db.query(
      `INSERT INTO sessions (id, user_id, token, erpnext_sid, expires_at)
       VALUES (gen_random_uuid()::text, $1, $2, $3, $4)`,
      [userId, tokenHash, encryptedSid, expiresAt]
    );

    await db.end();

    async function cleanup() {
      const cleanDb = getDb();
      await cleanDb.connect();
      try {
        await cleanDb.query(`DELETE FROM sessions WHERE user_id = $1`, [userId]);
        await cleanDb.query(`DELETE FROM users WHERE id = $1`, [userId]);
        await cleanDb.query(`DELETE FROM accounts WHERE id = $1`, [accountId]);
      } finally {
        await cleanDb.end();
      }
    }

    return { sessionCookie: rawToken, userId, accountId, role, cleanup };
  } catch (err) {
    await db.end();
    throw err;
  }
}
