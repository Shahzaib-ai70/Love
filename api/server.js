import "dotenv/config";
import { randomBytes, randomUUID, createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import bcrypt from "bcryptjs";
import { createRequire } from "node:module";
import express from "express";
import initSqlJs from "sql.js";

const apiDirectory = dirname(fileURLToPath(import.meta.url));
const databasePath = resolve(process.env.DB_PATH || "data/love-memories.sqlite");
const require = createRequire(import.meta.url);
const SQL = await initSqlJs({
  locateFile: (file) => resolve(dirname(require.resolve("sql.js")), file),
});
const sessionCookieName = "love_memory_session";
const adminSessionCookieName = "love_admin_session";
const sessionDurationMs = 30 * 24 * 60 * 60 * 1000;
const maxMediaDataLength = 21 * 1024 * 1024;
const authRateLimitWindowMs = 15 * 60 * 1000;
const authRateLimitMax = 10;

mkdirSync(dirname(databasePath), { recursive: true });

let database = existsSync(databasePath)
  ? new SQL.Database(readFileSync(databasePath))
  : new SQL.Database();
database.run("PRAGMA foreign_keys = ON");
database.exec(readFileSync(resolve(apiDirectory, "schema.sql"), "utf8"));

function persistDatabase() {
  const temporaryPath = `${databasePath}.tmp`;
  writeFileSync(temporaryPath, Buffer.from(database.export()));
  renameSync(temporaryPath, databasePath);
}

function prepare(sql) {
  return {
    get(...parameters) {
      const statement = database.prepare(sql);

      try {
        statement.bind(parameters);
        return statement.step() ? statement.getAsObject() : undefined;
      } finally {
        statement.free();
      }
    },
    all(...parameters) {
      const statement = database.prepare(sql);
      const rows = [];

      try {
        statement.bind(parameters);
        while (statement.step()) {
          rows.push(statement.getAsObject());
        }
      } finally {
        statement.free();
      }

      return rows;
    },
    run(...parameters) {
      const previousDatabase = database.export();
      try {
        database.run(sql, parameters);
        const changes = database.getRowsModified();
        persistDatabase();
        return { changes };
      } catch (error) {
        database.close();
        database = new SQL.Database(previousDatabase);
        database.run("PRAGMA foreign_keys = ON");

        const temporaryPath = `${databasePath}.tmp`;
        if (existsSync(temporaryPath)) {
          unlinkSync(temporaryPath);
        }
        throw error;
      }
    },
  };
}

const app = express();
const authAttempts = new Map();
const selectUser = prepare(
  "SELECT id, username, display_name AS displayName, created_at AS createdAt FROM users WHERE id = ?"
);
const insertSession = prepare(
  "INSERT INTO sessions (token_hash, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)"
);
const selectPartner = prepare(
  `SELECT users.id, users.username, users.display_name AS displayName
   FROM partner_links
   JOIN users ON users.id = partner_links.partner_id
   WHERE partner_links.user_id = ?`
);

app.disable("x-powered-by");
app.set("trust proxy", "loopback");
app.use((request, response, next) => {
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.setHeader("X-Frame-Options", "SAMEORIGIN");
  response.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  next();
});
app.use(express.json({ limit: "32mb" }));

function sendError(response, status, message) {
  return response.status(status).json({ error: message });
}

function normalizeUsername(value) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function validateCredentials({ username, password }) {
  if (!/^[a-z0-9][a-z0-9._-]{2,31}$/.test(username)) {
    return "Use a username with 3-32 letters, numbers, dots, underscores, or hyphens.";
  }

  if (
    typeof password !== "string" ||
    password.length < 8 ||
    Buffer.byteLength(password, "utf8") > 72
  ) {
    return "Use a password with at least 8 characters and no more than 72 bytes.";
  }

  return "";
}

function hashSessionToken(token) {
  return createHash("sha256").update(token).digest("hex");
}

function parseCookies(cookieHeader = "") {
  return Object.fromEntries(
    cookieHeader
      .split(";")
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const separator = part.indexOf("=");
        return [
          part.slice(0, separator),
          decodeURIComponent(part.slice(separator + 1)),
        ];
      })
  );
}

function setSessionCookie(response, token) {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  response.setHeader(
    "Set-Cookie",
    `${sessionCookieName}=${encodeURIComponent(token)}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${sessionDurationMs / 1000}${secure}`
  );
}

function clearSessionCookie(response) {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  response.setHeader(
    "Set-Cookie",
    `${sessionCookieName}=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0${secure}`
  );
}

function setAdminSessionCookie(response, token) {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  response.setHeader(
    "Set-Cookie",
    `${adminSessionCookieName}=${encodeURIComponent(token)}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${sessionDurationMs / 1000}${secure}`
  );
}

function clearAdminSessionCookie(response) {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  response.setHeader(
    "Set-Cookie",
    `${adminSessionCookieName}=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0${secure}`
  );
}

function createSession(userId, response) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = Date.now() + sessionDurationMs;

  insertSession.run(
    hashSessionToken(token),
    userId,
    expiresAt,
    new Date().toISOString()
  );
  setSessionCookie(response, token);
}

function createAdminSession(username, response) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = Date.now() + sessionDurationMs;

  prepare(
    "INSERT INTO admin_sessions (token_hash, username, expires_at, created_at) VALUES (?, ?, ?, ?)"
  ).run(hashSessionToken(token), username, expiresAt, new Date().toISOString());
  setAdminSessionCookie(response, token);
}

function requireAuth(request, response, next) {
  const token = parseCookies(request.headers.cookie)[sessionCookieName];

  if (!token) {
    return sendError(response, 401, "Please sign in to continue.");
  }

  const tokenHash = hashSessionToken(token);
  const session = prepare(
    "SELECT user_id AS userId, expires_at AS expiresAt FROM sessions WHERE token_hash = ?"
  )
    .get(tokenHash);

  if (!session || session.expiresAt <= Date.now()) {
    prepare("DELETE FROM sessions WHERE token_hash = ?").run(tokenHash);
    clearSessionCookie(response);
    return sendError(response, 401, "Your session expired. Please sign in again.");
  }

  const user = selectUser.get(session.userId);

  if (!user) {
    prepare("DELETE FROM sessions WHERE token_hash = ?").run(tokenHash);
    clearSessionCookie(response);
    return sendError(response, 401, "Your session is no longer valid. Please sign in again.");
  }

  request.user = user;
  request.sessionTokenHash = tokenHash;
  return next();
}

function requireAdmin(request, response, next) {
  const token = parseCookies(request.headers.cookie)[adminSessionCookieName];

  if (!token) {
    return sendError(response, 401, "Please sign in with the separate admin account.");
  }

  const tokenHash = hashSessionToken(token);
  const session = prepare(
    "SELECT username, expires_at AS expiresAt FROM admin_sessions WHERE token_hash = ?"
  ).get(tokenHash);

  if (!session || session.expiresAt <= Date.now()) {
    prepare("DELETE FROM admin_sessions WHERE token_hash = ?").run(tokenHash);
    clearAdminSessionCookie(response);
    return sendError(response, 401, "Your admin session expired. Please sign in again.");
  }

  if (normalizeUsername(session.username) !== normalizeUsername(process.env.ADMIN_USERNAME)) {
    prepare("DELETE FROM admin_sessions WHERE token_hash = ?").run(tokenHash);
    clearAdminSessionCookie(response);
    return sendError(response, 401, "The admin account has changed. Please sign in again.");
  }

  request.admin = { username: session.username };
  request.adminSessionTokenHash = tokenHash;
  return next();
}

function takeAuthAttempt(request, response, next) {
  const now = Date.now();
  const key = `${request.ip || request.socket.remoteAddress || "unknown"}:${request.path}`;
  const attempt = authAttempts.get(key);

  if (attempt && attempt.resetAt > now && attempt.count >= authRateLimitMax) {
    response.setHeader("Retry-After", Math.ceil((attempt.resetAt - now) / 1000));
    return sendError(response, 429, "Too many sign-in attempts. Please wait and try again.");
  }

  response.once("finish", () => {
    if (response.statusCode === 401) {
      const currentAttempt = authAttempts.get(key);

      if (!currentAttempt || currentAttempt.resetAt <= Date.now()) {
        authAttempts.set(key, {
          count: 1,
          resetAt: Date.now() + authRateLimitWindowMs,
        });
      } else {
        currentAttempt.count += 1;
      }
    }
  });

  if (authAttempts.size > 10000) {
    for (const [attemptKey, value] of authAttempts) {
      if (value.resetAt <= now) {
        authAttempts.delete(attemptKey);
      }
    }
  }

  return next();
}

function clearAuthAttempts(request) {
  const key = `${request.ip || request.socket.remoteAddress || "unknown"}:${request.path}`;
  authAttempts.delete(key);
}

function mapMemory(row) {
  return {
    id: row.id,
    userId: row.userId,
    title: row.title,
    text: row.text,
    mediaUrl: row.mediaUrl,
    mediaData: row.mediaData,
    mediaFileName: row.mediaFileName,
    mediaType: row.mediaType,
    createdAt: row.createdAt,
  };
}

const selectUserMemories = prepare(
  `SELECT id, user_id AS userId, title, text, media_url AS mediaUrl,
          media_data AS mediaData, media_file_name AS mediaFileName,
          media_type AS mediaType, created_at AS createdAt
   FROM memories
   WHERE user_id = ?
   ORDER BY created_at DESC`
);

function validateMemory(memory) {
  if (!memory || typeof memory !== "object") {
    return "A valid memory is required.";
  }

  if (typeof memory.title !== "string" || !memory.title.trim() || memory.title.length > 160) {
    return "Add a title of 1-160 characters.";
  }

  if (typeof memory.text !== "string" || memory.text.length > 50000) {
    return "Memory text must be 50,000 characters or fewer.";
  }

  if (
    typeof memory.mediaUrl !== "string" ||
    memory.mediaUrl.length > 2048 ||
    (memory.mediaUrl && !/^https?:\/\//i.test(memory.mediaUrl))
  ) {
    return "Use a valid HTTP or HTTPS media URL.";
  }

  if (typeof memory.mediaData !== "string" || memory.mediaData.length > maxMediaDataLength) {
    return "Uploaded media must be 15 MB or smaller.";
  }

  if (
    memory.mediaData &&
    !/^data:(image\/(png|jpeg|webp|gif)|video\/(mp4|webm|ogg));base64,/i.test(memory.mediaData)
  ) {
    return "Upload a supported image or video file.";
  }

  if (
    typeof memory.mediaFileName !== "string" ||
    memory.mediaFileName.length > 255 ||
    !["text", "image", "video"].includes(memory.mediaType)
  ) {
    return "Memory media details are invalid.";
  }

  if (
    memory.sourceLocalId !== undefined &&
    (typeof memory.sourceLocalId !== "string" || memory.sourceLocalId.length > 200)
  ) {
    return "The local memory import identifier is invalid.";
  }

  return "";
}

app.get("/api/health", (_request, response) => {
  response.json({ status: "ok", storage: "sqlite" });
});

app.post("/api/auth/signup", takeAuthAttempt, async (request, response, next) => {
  const username = normalizeUsername(request.body?.username);
  const password = request.body?.password;
  const displayName =
    typeof request.body?.displayName === "string" ? request.body.displayName.trim() : "";
  const validationError = validateCredentials({ username, password });

  if (validationError) {
    return sendError(response, 400, validationError);
  }

  if (displayName.length > 100) {
    return sendError(response, 400, "Display name must be 100 characters or fewer.");
  }

  try {
    const userId = randomUUID();
    const passwordHash = await bcrypt.hash(password, 12);

    prepare(
        "INSERT INTO users (id, username, display_name, password_hash, created_at) VALUES (?, ?, ?, ?, ?)"
      )
      .run(userId, username, displayName, passwordHash, new Date().toISOString());
    createSession(userId, response);
    clearAuthAttempts(request);
    return response.status(201).json({ user: selectUser.get(userId) });
  } catch (error) {
    if (/UNIQUE constraint failed: users\.username/i.test(error?.message || "")) {
      return sendError(response, 409, "This username already exists. Try another username.");
    }

    return next(error);
  }
});

app.post("/api/auth/signin", takeAuthAttempt, async (request, response, next) => {
  const username = normalizeUsername(request.body?.username);
  const password = request.body?.password;

  if (!username || typeof password !== "string" || password.length > 72) {
    return sendError(response, 401, "Wrong username or password.");
  }

  try {
    const account = prepare(
        "SELECT id, password_hash AS passwordHash FROM users WHERE username = ? COLLATE NOCASE"
      )
      .get(username);

    if (!account || !(await bcrypt.compare(password, account.passwordHash))) {
      return sendError(response, 401, "Wrong username or password.");
    }

    createSession(account.id, response);
    clearAuthAttempts(request);
    return response.json({ user: selectUser.get(account.id) });
  } catch (error) {
    return next(error);
  }
});

app.get("/api/auth/me", requireAuth, (request, response) => {
  response.json({ user: request.user });
});

app.post("/api/auth/logout", requireAuth, (request, response) => {
  prepare("DELETE FROM sessions WHERE token_hash = ?")
    .run(request.sessionTokenHash);
  clearSessionCookie(response);
  response.status(204).end();
});

app.post("/api/admin/auth/signin", takeAuthAttempt, async (request, response, next) => {
  const adminUsername = normalizeUsername(process.env.ADMIN_USERNAME);
  const adminPasswordHash = process.env.ADMIN_PASSWORD_HASH;
  const username = normalizeUsername(request.body?.username);
  const password = request.body?.password;

  if (!adminUsername || !adminPasswordHash) {
    return sendError(
      response,
      503,
      "Separate admin credentials are not configured on the server."
    );
  }

  if (!username || typeof password !== "string" || password.length > 72) {
    return sendError(response, 401, "Wrong admin username or password.");
  }

  try {
    if (
      username !== adminUsername ||
      !(await bcrypt.compare(password, adminPasswordHash))
    ) {
      return sendError(response, 401, "Wrong admin username or password.");
    }

    createAdminSession(process.env.ADMIN_USERNAME.trim(), response);
    clearAuthAttempts(request);
    return response.json({ admin: { username: process.env.ADMIN_USERNAME.trim() } });
  } catch (error) {
    return next(error);
  }
});

app.get("/api/admin/auth/me", requireAdmin, (request, response) => {
  response.json({ admin: request.admin });
});

app.post("/api/admin/auth/logout", requireAdmin, (request, response) => {
  prepare("DELETE FROM admin_sessions WHERE token_hash = ?")
    .run(request.adminSessionTokenHash);
  clearAdminSessionCookie(response);
  response.status(204).end();
});

app.get("/api/chat", requireAuth, (request, response) => {
  const partner = selectPartner.get(request.user.id) || null;
  const receivedInvites = prepare(
    `SELECT partner_invites.id, partner_invites.created_at AS createdAt,
            users.id AS userId, users.username, users.display_name AS displayName
     FROM partner_invites
     JOIN users ON users.id = partner_invites.sender_id
     WHERE partner_invites.recipient_id = ? AND partner_invites.status = 'pending'
     ORDER BY partner_invites.created_at ASC`
  ).all(request.user.id);
  const sentInvites = prepare(
    `SELECT partner_invites.id, partner_invites.created_at AS createdAt,
            users.id AS userId, users.username, users.display_name AS displayName
     FROM partner_invites
     JOIN users ON users.id = partner_invites.recipient_id
     WHERE partner_invites.sender_id = ? AND partner_invites.status = 'pending'
     ORDER BY partner_invites.created_at ASC`
  ).all(request.user.id);
  const messages = partner
    ? prepare(
        `SELECT id, sender_id AS senderId, recipient_id AS recipientId,
                text, created_at AS createdAt
         FROM chat_messages
         WHERE (sender_id = ? AND recipient_id = ?)
            OR (sender_id = ? AND recipient_id = ?)
         ORDER BY created_at DESC
         LIMIT 500`
      )
        .all(request.user.id, partner.id, partner.id, request.user.id)
        .reverse()
    : [];

  response.json({ partner, receivedInvites, sentInvites, messages });
});

app.post("/api/chat/invites", requireAuth, (request, response, next) => {
  const username = normalizeUsername(request.body?.username);

  if (!/^[a-z0-9][a-z0-9._-]{2,31}$/.test(username)) {
    return sendError(response, 400, "Enter a valid partner username.");
  }

  const recipient = prepare(
    "SELECT id FROM users WHERE username = ? COLLATE NOCASE"
  ).get(username);

  if (!recipient) {
    return sendError(response, 404, "No account was found with that username.");
  }

  if (recipient.id === request.user.id) {
    return sendError(response, 400, "You cannot invite your own account.");
  }

  if (selectPartner.get(request.user.id) || selectPartner.get(recipient.id)) {
    return sendError(response, 409, "One of these accounts already has a chat partner.");
  }

  const existingInvite = prepare(
    `SELECT sender_id AS senderId, recipient_id AS recipientId
     FROM partner_invites
     WHERE status = 'pending'
       AND ((sender_id = ? AND recipient_id = ?) OR (sender_id = ? AND recipient_id = ?))`
  ).get(request.user.id, recipient.id, recipient.id, request.user.id);

  if (existingInvite) {
    return sendError(
      response,
      409,
      existingInvite.senderId === recipient.id
        ? "This person already invited you. Accept their invitation below."
        : "Your invitation is already waiting for a response."
    );
  }

  try {
    const now = new Date().toISOString();
    const inviteId = randomUUID();
    prepare(
      `INSERT INTO partner_invites (id, sender_id, recipient_id, status, created_at, updated_at)
       VALUES (?, ?, ?, 'pending', ?, ?)`
    ).run(inviteId, request.user.id, recipient.id, now, now);

    return response.status(201).json({ inviteId });
  } catch (error) {
    return next(error);
  }
});

app.post("/api/chat/invites/:inviteId/accept", requireAuth, (request, response, next) => {
  const invite = prepare(
    `SELECT id, sender_id AS senderId, recipient_id AS recipientId, status
     FROM partner_invites WHERE id = ? AND recipient_id = ?`
  ).get(request.params.inviteId, request.user.id);

  if (!invite || invite.status !== "pending") {
    return sendError(response, 404, "Pending invitation not found.");
  }

  if (selectPartner.get(invite.senderId) || selectPartner.get(invite.recipientId)) {
    return sendError(response, 409, "One of these accounts already has a chat partner.");
  }

  const linkedAt = new Date().toISOString();

  try {
    database.run("BEGIN IMMEDIATE");
    database.run(
      "UPDATE partner_invites SET status = 'accepted', updated_at = ? WHERE id = ?",
      [linkedAt, invite.id]
    );
    database.run(
      `INSERT INTO partner_links (user_id, partner_id, linked_at) VALUES (?, ?, ?), (?, ?, ?)`,
      [invite.senderId, invite.recipientId, linkedAt, invite.recipientId, invite.senderId, linkedAt]
    );
    database.run(
      `UPDATE partner_invites
       SET status = 'cancelled', updated_at = ?
       WHERE status = 'pending'
         AND (sender_id IN (?, ?) OR recipient_id IN (?, ?))`,
      [linkedAt, invite.senderId, invite.recipientId, invite.senderId, invite.recipientId]
    );
    database.run("COMMIT");
    persistDatabase();
  } catch (error) {
    database.run("ROLLBACK");
    return next(error);
  }

  response.json({ partner: selectPartner.get(request.user.id) });
});

app.post("/api/chat/invites/:inviteId/decline", requireAuth, (request, response) => {
  const result = prepare(
    `UPDATE partner_invites SET status = 'declined', updated_at = ?
     WHERE id = ? AND recipient_id = ? AND status = 'pending'`
  ).run(new Date().toISOString(), request.params.inviteId, request.user.id);

  if (!result.changes) {
    return sendError(response, 404, "Pending invitation not found.");
  }

  response.status(204).end();
});

app.post("/api/chat/messages", requireAuth, (request, response, next) => {
  const text = typeof request.body?.text === "string" ? request.body.text.trim() : "";

  if (!text || text.length > 5000) {
    return sendError(response, 400, "Write a message of 1-5,000 characters.");
  }

  const partner = selectPartner.get(request.user.id);

  if (!partner) {
    return sendError(response, 403, "Accept a partner invitation before sending messages.");
  }

  try {
    const message = {
      id: randomUUID(),
      senderId: request.user.id,
      recipientId: partner.id,
      text,
      createdAt: new Date().toISOString(),
    };
    prepare(
      `INSERT INTO chat_messages (id, sender_id, recipient_id, text, created_at)
       VALUES (?, ?, ?, ?, ?)`
    ).run(message.id, message.senderId, message.recipientId, message.text, message.createdAt);

    return response.status(201).json({ message });
  } catch (error) {
    return next(error);
  }
});

app.get("/api/memories", requireAuth, (request, response) => {
  response.json({
    memories: selectUserMemories.all(request.user.id).map(mapMemory),
  });
});

app.post("/api/memories", requireAuth, (request, response, next) => {
  const memory = request.body;
  const validationError = validateMemory(memory);

  if (validationError) {
    return sendError(response, 400, validationError);
  }

  try {
    const memoryId = randomUUID();
    const createdAt = new Date().toISOString();
    const result = prepare(
        `INSERT INTO memories (
           id, user_id, title, text, media_url, media_data, media_file_name,
           media_type, source_local_id, created_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(user_id, source_local_id) DO NOTHING`
      )
      .run(
        memoryId,
        request.user.id,
        memory.title.trim(),
        memory.text.trim(),
        memory.mediaUrl.trim(),
        memory.mediaData,
        memory.mediaFileName,
        memory.mediaType,
        memory.sourceLocalId || null,
        createdAt
      );

    const storedMemory = result.changes
      ? prepare(
            `SELECT id, user_id AS userId, title, text, media_url AS mediaUrl,
                    media_data AS mediaData, media_file_name AS mediaFileName,
                    media_type AS mediaType, created_at AS createdAt
             FROM memories WHERE id = ?`
          )
          .get(memoryId)
      : prepare(
            `SELECT id, user_id AS userId, title, text, media_url AS mediaUrl,
                    media_data AS mediaData, media_file_name AS mediaFileName,
                    media_type AS mediaType, created_at AS createdAt
             FROM memories WHERE user_id = ? AND source_local_id = ?`
          )
          .get(request.user.id, memory.sourceLocalId);

    return response.status(result.changes ? 201 : 200).json({
      memory: mapMemory(storedMemory),
      imported: Boolean(result.changes),
    });
  } catch (error) {
    return next(error);
  }
});

app.delete("/api/memories/:memoryId", requireAuth, (request, response, next) => {
  try {
    const result = prepare("DELETE FROM memories WHERE id = ? AND user_id = ?")
      .run(request.params.memoryId, request.user.id);

    if (!result.changes) {
      return sendError(response, 404, "Memory not found.");
    }

    return response.status(204).end();
  } catch (error) {
    return next(error);
  }
});

app.get("/api/admin/users", requireAdmin, (request, response) => {
  const users = prepare(
      `SELECT users.id, users.username, users.display_name AS displayName,
              users.created_at AS createdAt,
              (SELECT COUNT(*) FROM memories WHERE memories.user_id = users.id) AS memoryCount,
              (SELECT COUNT(*) FROM chat_messages
               WHERE chat_messages.sender_id = users.id OR chat_messages.recipient_id = users.id)
                AS messageCount,
              partner.username AS partnerUsername,
              partner.display_name AS partnerDisplayName
       FROM users
       LEFT JOIN partner_links ON partner_links.user_id = users.id
       LEFT JOIN users AS partner ON partner.id = partner_links.partner_id
       ORDER BY users.created_at DESC`
    )
    .all();

  return response.json({ users });
});

app.get("/api/admin/users/:userId", requireAdmin, (request, response) => {
  const user = selectUser.get(request.params.userId);

  if (!user) {
    return sendError(response, 404, "User not found.");
  }

  const partner = selectPartner.get(user.id) || null;
  const memories = prepare(
    `SELECT id, title, text, media_url AS mediaUrl, media_data AS mediaData,
            media_file_name AS mediaFileName, media_type AS mediaType,
            created_at AS createdAt
     FROM memories WHERE user_id = ? ORDER BY created_at DESC`
  ).all(user.id);
  const messages = prepare(
    `SELECT chat_messages.id, chat_messages.sender_id AS senderId,
            chat_messages.recipient_id AS recipientId, chat_messages.text,
            chat_messages.created_at AS createdAt,
            sender.username AS senderUsername,
            recipient.username AS recipientUsername
     FROM chat_messages
     JOIN users AS sender ON sender.id = chat_messages.sender_id
     JOIN users AS recipient ON recipient.id = chat_messages.recipient_id
     WHERE chat_messages.sender_id = ? OR chat_messages.recipient_id = ?
     ORDER BY chat_messages.created_at ASC`
  ).all(user.id, user.id);
  const invites = prepare(
    `SELECT partner_invites.id, partner_invites.status,
            partner_invites.created_at AS createdAt,
            partner_invites.updated_at AS updatedAt,
            sender.username AS senderUsername,
            recipient.username AS recipientUsername
     FROM partner_invites
     JOIN users AS sender ON sender.id = partner_invites.sender_id
     JOIN users AS recipient ON recipient.id = partner_invites.recipient_id
     WHERE partner_invites.sender_id = ? OR partner_invites.recipient_id = ?
     ORDER BY partner_invites.created_at DESC`
  ).all(user.id, user.id);

  response.json({ user, partner, memories, messages, invites });
});

app.use((error, _request, response, _next) => {
  if (error?.type === "entity.too.large") {
    return sendError(response, 413, "Request is too large. Keep uploaded files under 15 MB.");
  }

  console.error("API request failed:", error);
  return sendError(response, 500, "The server could not complete this request.");
});

const port = Number(process.env.PORT || 3001);
const server = app.listen(port, "127.0.0.1", () => {
  console.log(`Memory SQL API listening on 127.0.0.1:${port}`);
});

function shutdown() {
  server.close(() => {
    database.close();
    process.exit(0);
  });
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
