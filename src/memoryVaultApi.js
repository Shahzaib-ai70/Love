import {
  getVaultAccounts,
  getUserMemories as getLocalUserMemories,
} from "./localMemoryVault";

const API_BASE = "/api";

async function request(path, { method = "GET", body } = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    method,
    credentials: "same-origin",
    headers: body === undefined ? {} : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  const contentType = response.headers.get("content-type") || "";
  const payload = contentType.includes("application/json")
    ? await response.json()
    : await response.text();

  if (!response.ok) {
    const message =
      typeof payload === "string" ? payload : payload?.error || payload?.message;
    throw new Error(message || `Request failed with status ${response.status}.`);
  }

  return payload;
}

export function getMemoryStorageMode() {
  return "sql";
}

export async function createVaultAccount({ displayName, username, password }) {
  const { user } = await request("/auth/signup", {
    method: "POST",
    body: { displayName, username, password },
  });
  return user;
}

export async function signInVaultAccount({ username, password }) {
  const { user } = await request("/auth/signin", {
    method: "POST",
    body: { username, password },
  });
  return user;
}

export async function getCurrentVaultUser() {
  try {
    const { user } = await request("/auth/me");
    return user;
  } catch (error) {
    if (error instanceof Error && /sign in|required|session/i.test(error.message)) {
      return null;
    }

    throw error;
  }
}

export async function signOutVaultAccount() {
  await request("/auth/logout", { method: "POST" });
}

export async function signInAdminAccount({ username, password }) {
  const { admin } = await request("/admin/auth/signin", {
    method: "POST",
    body: { username, password },
  });
  return admin;
}

export async function getCurrentAdminAccount() {
  try {
    const { admin } = await request("/admin/auth/me");
    return admin;
  } catch (error) {
    if (error instanceof Error && /sign in|required|session|admin account/i.test(error.message)) {
      return null;
    }

    throw error;
  }
}

export async function signOutAdminAccount() {
  await request("/admin/auth/logout", { method: "POST" });
}

export async function saveUserMemory(memory) {
  const { memory: savedMemory } = await request("/memories", {
    method: "POST",
    body: memory,
  });
  return savedMemory;
}

export async function getUserMemories() {
  const { memories } = await request("/memories");
  return memories;
}

export async function deleteUserMemory(memoryId) {
  await request(`/memories/${encodeURIComponent(memoryId)}`, { method: "DELETE" });
}

export async function getPartnerChat() {
  return request("/chat");
}

export async function createPartnerInvite(username) {
  return request("/chat/invites", {
    method: "POST",
    body: { username },
  });
}

export async function respondToPartnerInvite(inviteId, response) {
  await request(`/chat/invites/${encodeURIComponent(inviteId)}/${response}`, {
    method: "POST",
  });
}

export async function sendPartnerMessage(text) {
  const { message } = await request("/chat/messages", {
    method: "POST",
    body: { text },
  });
  return message;
}

export async function importLocalMemories() {
  const currentUser = await getCurrentVaultUser();

  if (!currentUser) {
    throw new Error("Sign in first to import browser memories.");
  }

  const localAccount = getVaultAccounts().find(
    (account) => account.username === currentUser.username
  );

  if (!localAccount) {
    throw new Error("No browser-local account with this username was found on this device.");
  }

  const localMemories = getLocalUserMemories(localAccount.id);
  let importedCount = 0;

  for (const memory of localMemories) {
    const { imported } = await request("/memories", {
      method: "POST",
      body: {
        title: memory.title || "Untitled memory",
        text: memory.text || "",
        mediaUrl: memory.mediaUrl || "",
        mediaData: memory.mediaData || "",
        mediaFileName: memory.mediaFileName || "",
        mediaType: memory.mediaType || "text",
        sourceLocalId: memory.id,
      },
    });

    if (imported) {
      importedCount += 1;
    }
  }

  return {
    importedCount,
    totalCount: localMemories.length,
  };
}

export async function getCloudAdminUsers() {
  const { users } = await request("/admin/users");
  return { users };
}

export async function getCloudAdminUserDetails(userId) {
  return request(`/admin/users/${encodeURIComponent(userId)}`);
}
