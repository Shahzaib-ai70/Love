import assert from "node:assert/strict";
import bcrypt from "bcryptjs";
import { spawn } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { after, before, test } from "node:test";
import { fileURLToPath } from "node:url";
import initSqlJs from "sql.js";

const apiDirectory = fileURLToPath(new URL(".", import.meta.url));
const projectDirectory = resolve(apiDirectory, "..");
const temporaryDirectory = await mkdtemp(join(tmpdir(), "love-memories-api-"));
const apiPort = await getFreePort();
let baseUrl;
let apiChild;

async function getFreePort() {
  const server = createServer();
  await new Promise((resolveListen, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolveListen);
  });
  const { port } = server.address();
  await new Promise((resolveClose, reject) => {
    server.close((error) => (error ? reject(error) : resolveClose()));
  });
  return port;
}

async function apiRequest(path, { method = "GET", cookie, body } = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      ...(cookie ? { Cookie: cookie } : {}),
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const payload = response.status === 204 ? null : await response.json();

  return {
    status: response.status,
    payload,
    cookie: response.headers.getSetCookie()?.[0]?.split(";")[0] || cookie,
  };
}

async function startApi(adminConfigured = false) {
  apiChild = spawn(process.execPath, [join(apiDirectory, "server.js")], {
    cwd: projectDirectory,
    env: {
      ...process.env,
      NODE_ENV: "test",
      PORT: String(apiPort),
      DB_PATH: join(temporaryDirectory, "test.sqlite"),
      ADMIN_USERNAME: adminConfigured ? "SHAHZAIBKS" : "",
      ADMIN_PASSWORD_HASH: adminConfigured
        ? bcrypt.hashSync("separate-admin-pass-123", 4)
        : "",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });

  let startupOutput = "";
  apiChild.stdout.on("data", (chunk) => {
    startupOutput += chunk.toString();
  });
  apiChild.stderr.on("data", (chunk) => {
    startupOutput += chunk.toString();
  });

  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (apiChild.exitCode !== null) {
      throw new Error(`API process exited during startup: ${startupOutput}`);
    }

    try {
      const response = await fetch(`${baseUrl}/api/health`);
      if (response.ok) {
        return;
      }
    } catch {
      await delay(100);
    }
  }

  throw new Error(`API did not start in time: ${startupOutput}`);
}

async function stopApi() {
  if (!apiChild || apiChild.exitCode !== null) {
    return;
  }

  const exited = new Promise((resolveExit) => apiChild.once("exit", resolveExit));
  apiChild.kill("SIGTERM");
  await exited;
}

before(async () => {
  baseUrl = `http://127.0.0.1:${apiPort}`;
  const SQL = await initSqlJs();
  const legacyDatabase = new SQL.Database();
  legacyDatabase.run(
    `CREATE TABLE users (
       id TEXT PRIMARY KEY,
       username TEXT NOT NULL COLLATE NOCASE UNIQUE,
       display_name TEXT NOT NULL DEFAULT '',
       password_hash TEXT NOT NULL,
       created_at TEXT NOT NULL
     )`
  );
  legacyDatabase.run(
    `CREATE TABLE partner_links (
       user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
       partner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
       linked_at TEXT NOT NULL,
       CHECK (user_id <> partner_id)
     )`
  );
  legacyDatabase.run(
    `INSERT INTO users (id, username, display_name, password_hash, created_at)
     VALUES
       ('legacy-one-id', 'legacyone', 'Legacy One', ?, '2024-01-01'),
       ('legacy-two-id', 'legacytwo', 'Legacy Two', ?, '2024-01-01')`,
    [
      bcrypt.hashSync("legacy-one-pass-123", 4),
      bcrypt.hashSync("legacy-two-pass-123", 4),
    ]
  );
  legacyDatabase.run(
    `INSERT INTO partner_links (user_id, partner_id, linked_at)
     VALUES ('legacy-one-id', 'legacy-two-id', '2024-01-01'),
            ('legacy-two-id', 'legacy-one-id', '2024-01-01')`
  );
  await writeFile(join(temporaryDirectory, "test.sqlite"), Buffer.from(legacyDatabase.export()));
  legacyDatabase.close();
  await startApi();
});

after(async () => {
  await stopApi();
  await rm(temporaryDirectory, { recursive: true, force: true });
});

test("SQL auth, private memories, import idempotence, and admin permissions work", async () => {
  const health = await fetch(`${baseUrl}/api/health`).then((response) => response.json());
  assert.deepEqual(health, { status: "ok", storage: "sqlite" });

  const migratedAccount = await apiRequest("/api/auth/signin", {
    method: "POST",
    body: { username: "legacyone", password: "legacy-one-pass-123" },
  });
  assert.equal(migratedAccount.status, 200);
  const migratedChat = await apiRequest("/api/chat", { cookie: migratedAccount.cookie });
  assert.equal(migratedChat.payload.partners.length, 1);
  assert.equal(migratedChat.payload.partner.username, "legacytwo");

  for (let attempt = 0; attempt < 10; attempt += 1) {
    const failedSignIn = await apiRequest("/api/auth/signin", {
      method: "POST",
      body: { username: "missing-user", password: "wrong-password-123" },
    });
    assert.equal(failedSignIn.status, 401);
  }

  const rateLimitedSignIn = await apiRequest("/api/auth/signin", {
    method: "POST",
    body: { username: "missing-user", password: "wrong-password-123" },
  });
  assert.equal(rateLimitedSignIn.status, 429);

  const adminSignup = await apiRequest("/api/auth/signup", {
    method: "POST",
    body: {
      username: "Admin",
      displayName: "Site Admin",
      password: "admin-pass-123",
    },
  });
  assert.equal(adminSignup.status, 201);
  assert.equal(adminSignup.payload.user.username, "admin");
  assert.ok(adminSignup.cookie);

  const adminNotConfigured = await apiRequest("/api/admin/users", {
    cookie: adminSignup.cookie,
  });
  assert.equal(adminNotConfigured.status, 401);
  const missingAdminConfig = await apiRequest("/api/admin/auth/signin", {
    method: "POST",
    body: { username: "SHAHZAIBKS", password: "separate-admin-pass-123" },
  });
  assert.equal(missingAdminConfig.status, 503);
  await stopApi();
  await startApi(true);

  const wrongAdminSignIn = await apiRequest("/api/admin/auth/signin", {
    method: "POST",
    body: { username: "SHAHZAIBKS", password: "memory-account-pass-123" },
  });
  assert.equal(wrongAdminSignIn.status, 401);

  const adminSignIn = await apiRequest("/api/admin/auth/signin", {
    method: "POST",
    body: { username: "shahzaibks", password: "separate-admin-pass-123" },
  });
  assert.equal(adminSignIn.status, 200);
  assert.equal(adminSignIn.payload.admin.username, "SHAHZAIBKS");
  assert.ok(adminSignIn.cookie);

  const duplicateSignup = await apiRequest("/api/auth/signup", {
    method: "POST",
    body: {
      username: "ADMIN",
      password: "admin-pass-123",
    },
  });
  assert.equal(duplicateSignup.status, 409);

  const newMemory = await apiRequest("/api/memories", {
    method: "POST",
    cookie: adminSignup.cookie,
    body: {
      title: "First SQL memory",
      text: "Private content",
      mediaUrl: "",
      mediaData: "",
      mediaFileName: "",
      mediaType: "text",
    },
  });
  assert.equal(newMemory.status, 201);
  assert.equal(newMemory.payload.memory.text, "Private content");

  const localImport = {
    title: "Imported local memory",
    text: "Only import this once",
    mediaUrl: "",
    mediaData: "",
    mediaFileName: "",
    mediaType: "text",
    sourceLocalId: "old-browser-memory-1",
  };
  const firstImport = await apiRequest("/api/memories", {
    method: "POST",
    cookie: adminSignup.cookie,
    body: localImport,
  });
  const duplicateImport = await apiRequest("/api/memories", {
    method: "POST",
    cookie: adminSignup.cookie,
    body: localImport,
  });
  assert.equal(firstImport.payload.imported, true);
  assert.equal(duplicateImport.payload.imported, false);

  const guestSignup = await apiRequest("/api/auth/signup", {
    method: "POST",
    body: {
      username: "guest",
      displayName: "Guest User",
      password: "guest-pass-123",
    },
  });
  assert.equal(guestSignup.status, 201);

  const unauthenticatedChat = await apiRequest("/api/chat");
  assert.equal(unauthenticatedChat.status, 401);

  const invite = await apiRequest("/api/chat/invites", {
    method: "POST",
    cookie: guestSignup.cookie,
    body: { username: "ADMIN" },
  });
  assert.equal(invite.status, 201);

  const duplicateInvite = await apiRequest("/api/chat/invites", {
    method: "POST",
    cookie: guestSignup.cookie,
    body: { username: "admin" },
  });
  assert.equal(duplicateInvite.status, 409);

  const adminInvites = await apiRequest("/api/chat", {
    cookie: adminSignup.cookie,
  });
  assert.equal(adminInvites.payload.receivedInvites.length, 1);
  assert.equal(adminInvites.payload.receivedInvites[0].username, "guest");

  const acceptInvite = await apiRequest(
    `/api/chat/invites/${encodeURIComponent(invite.payload.inviteId)}/accept`,
    {
      method: "POST",
      cookie: adminSignup.cookie,
    }
  );
  assert.equal(acceptInvite.status, 200);
  assert.equal(acceptInvite.payload.partner.username, "guest");

  const guestChat = await apiRequest("/api/chat", {
    cookie: guestSignup.cookie,
  });
  assert.equal(guestChat.payload.partners.length, 1);
  assert.equal(guestChat.payload.partner.username, "admin");
  assert.deepEqual(guestChat.payload.messages, []);

  const sentChatMessage = await apiRequest("/api/chat/messages", {
    method: "POST",
    cookie: guestSignup.cookie,
    body: {
      recipientId: adminSignup.payload.user.id,
      text: "Hello from another device.",
    },
  });
  assert.equal(sentChatMessage.status, 201);

  const adminChat = await apiRequest("/api/chat", {
    cookie: adminSignup.cookie,
  });
  assert.equal(adminChat.payload.messages.length, 1);
  assert.equal(adminChat.payload.messages[0].text, "Hello from another device.");
  assert.equal(adminChat.payload.messages[0].senderId, guestSignup.payload.user.id);

  const unpairedSignup = await apiRequest("/api/auth/signup", {
    method: "POST",
    body: {
      username: "unpaired",
      password: "unpaired-pass-123",
    },
  });
  assert.equal(unpairedSignup.status, 201);
  const deniedUnpairedChat = await apiRequest("/api/chat/messages", {
    method: "POST",
    cookie: unpairedSignup.cookie,
    body: { recipientId: adminSignup.payload.user.id, text: "This must not be sent." },
  });
  assert.equal(deniedUnpairedChat.status, 403);

  const secondInvite = await apiRequest("/api/chat/invites", {
    method: "POST",
    cookie: unpairedSignup.cookie,
    body: { username: "admin" },
  });
  assert.equal(secondInvite.status, 201);
  const secondAccept = await apiRequest(
    `/api/chat/invites/${encodeURIComponent(secondInvite.payload.inviteId)}/accept`,
    { method: "POST", cookie: adminSignup.cookie }
  );
  assert.equal(secondAccept.status, 200);

  const adminPartnerChats = await apiRequest("/api/chat", {
    cookie: adminSignup.cookie,
  });
  assert.equal(adminPartnerChats.payload.partners.length, 2);
  assert.deepEqual(
    adminPartnerChats.payload.partners.map((partner) => partner.username),
    ["guest", "unpaired"]
  );

  const messageToSecondPartner = await apiRequest("/api/chat/messages", {
    method: "POST",
    cookie: adminSignup.cookie,
    body: { recipientId: unpairedSignup.payload.user.id, text: "Hello, second partner." },
  });
  assert.equal(messageToSecondPartner.status, 201);
  const secondPartnerChat = await apiRequest(
    `/api/chat?partnerId=${encodeURIComponent(adminSignup.payload.user.id)}`,
    { cookie: unpairedSignup.cookie }
  );
  assert.equal(secondPartnerChat.payload.messages.length, 1);
  assert.equal(secondPartnerChat.payload.messages[0].text, "Hello, second partner.");

  const usernameSearch = await apiRequest("/api/chat/search?username=admin", {
    cookie: unpairedSignup.cookie,
  });
  assert.equal(usernameSearch.status, 200);
  assert.equal(usernameSearch.payload.users[0].isPartner, 1);

  const guestMemories = await apiRequest("/api/memories", {
    cookie: guestSignup.cookie,
  });
  assert.deepEqual(guestMemories.payload.memories, []);

  const forbiddenAdminView = await apiRequest("/api/admin/users", {
    cookie: guestSignup.cookie,
  });
  assert.equal(forbiddenAdminView.status, 401);

  const deniedDelete = await apiRequest(
    `/api/memories/${encodeURIComponent(newMemory.payload.memory.id)}`,
    {
      method: "DELETE",
      cookie: guestSignup.cookie,
    }
  );
  assert.equal(deniedDelete.status, 404);

  const adminUsers = await apiRequest("/api/admin/users", {
    cookie: adminSignIn.cookie,
  });
  assert.equal(adminUsers.status, 200);
  assert.equal(adminUsers.payload.users.length, 5);
  assert.equal(
    adminUsers.payload.users.find((user) => user.username === "admin").memoryCount,
    2
  );
  assert.deepEqual(
    adminUsers.payload.users
      .find((user) => user.username === "admin")
      .partnerUsernames.split(", ")
      .sort(),
    ["guest", "unpaired"]
  );
  assert.equal(
    adminUsers.payload.users.find((user) => user.username === "admin").messageCount,
    2
  );
  assert.equal("password" in adminUsers.payload.users[0], false);
  assert.equal("passwordHash" in adminUsers.payload.users[0], false);

  const adminUserDetails = await apiRequest(
    `/api/admin/users/${encodeURIComponent(adminSignup.payload.user.id)}`,
    { cookie: adminSignIn.cookie }
  );
  assert.equal(adminUserDetails.status, 200);
  assert.equal(adminUserDetails.payload.memories.length, 2);
  assert.ok(
    adminUserDetails.payload.memories.some((memory) => memory.text === "Private content")
  );
  assert.equal(adminUserDetails.payload.messages.length, 2);
  assert.equal(adminUserDetails.payload.messages[0].senderUsername, "guest");
  assert.ok(adminUserDetails.payload.invites.every((invite) => invite.status === "accepted"));
  assert.deepEqual(
    adminUserDetails.payload.partners.map((partner) => partner.username),
    ["guest", "unpaired"]
  );
  assert.equal("passwordHash" in adminUserDetails.payload.user, false);

  const deniedAdminDetails = await apiRequest(
    `/api/admin/users/${encodeURIComponent(adminSignup.payload.user.id)}`,
    { cookie: guestSignup.cookie }
  );
  assert.equal(deniedAdminDetails.status, 401);

  const signIn = await apiRequest("/api/auth/signin", {
    method: "POST",
    body: {
      username: "ADMIN",
      password: "admin-pass-123",
    },
  });
  assert.equal(signIn.status, 200);
  assert.equal(signIn.payload.user.username, "admin");

  const logout = await apiRequest("/api/auth/logout", {
    method: "POST",
    cookie: signIn.cookie,
  });
  assert.equal(logout.status, 204);

  const expiredSession = await apiRequest("/api/auth/me", {
    cookie: signIn.cookie,
  });
  assert.equal(expiredSession.status, 401);

  const adminLogout = await apiRequest("/api/admin/auth/logout", {
    method: "POST",
    cookie: adminSignIn.cookie,
  });
  assert.equal(adminLogout.status, 204);
  const expiredAdminSession = await apiRequest("/api/admin/auth/me", {
    cookie: adminSignIn.cookie,
  });
  assert.equal(expiredAdminSession.status, 401);
});
