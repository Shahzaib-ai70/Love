const ACCOUNTS_KEY = "memory-vault-accounts-v1";
const MEMORIES_KEY = "memory-vault-memories-v1";
const SESSION_KEY = "memory-vault-session-v1";
const ADMIN_KEY = "memory-vault-admin-v1";

function readJson(key, fallbackValue) {
  if (typeof window === "undefined") {
    return fallbackValue;
  }

  try {
    const rawValue = window.localStorage.getItem(key);

    if (!rawValue) {
      return fallbackValue;
    }

    return JSON.parse(rawValue);
  } catch (error) {
    console.error(`Could not read local storage key: ${key}`, error);
    return fallbackValue;
  }
}

function writeJson(key, value) {
  window.localStorage.setItem(key, JSON.stringify(value));
}

function createId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function getVaultAccounts() {
  return readJson(ACCOUNTS_KEY, []);
}

export function saveVaultAccounts(accounts) {
  writeJson(ACCOUNTS_KEY, accounts);
}

export function getVaultMemories() {
  return readJson(MEMORIES_KEY, []);
}

export function saveVaultMemories(memories) {
  writeJson(MEMORIES_KEY, memories);
}

export function getVaultSession() {
  return readJson(SESSION_KEY, null);
}

export function saveVaultSession(session) {
  writeJson(SESSION_KEY, session);
}

export function clearVaultSession() {
  window.localStorage.removeItem(SESSION_KEY);
}

export function getAdminConfig() {
  return readJson(ADMIN_KEY, null);
}

export function saveAdminConfig(config) {
  writeJson(ADMIN_KEY, config);
}

export function createVaultAccount({ displayName, username, password }) {
  const normalizedUsername = username.trim().toLowerCase();
  const accounts = getVaultAccounts();

  if (accounts.some((account) => account.username === normalizedUsername)) {
    throw new Error("This username already exists. Try another username.");
  }

  const newAccount = {
    id: createId("user"),
    displayName: displayName.trim(),
    username: normalizedUsername,
    password,
    createdAt: new Date().toISOString(),
  };

  saveVaultAccounts([...accounts, newAccount]);
  saveVaultSession({ userId: newAccount.id });

  return newAccount;
}

export function signInVaultAccount({ username, password }) {
  const normalizedUsername = username.trim().toLowerCase();
  const account = getVaultAccounts().find(
    (item) => item.username === normalizedUsername && item.password === password
  );

  if (!account) {
    throw new Error("Wrong username or password.");
  }

  saveVaultSession({ userId: account.id });
  return account;
}

export function getCurrentVaultUser() {
  const session = getVaultSession();

  if (!session?.userId) {
    return null;
  }

  return getVaultAccounts().find((account) => account.id === session.userId) || null;
}

export function signOutVaultAccount() {
  clearVaultSession();
}

export function saveUserMemory(memory) {
  const memories = getVaultMemories();
  const newMemory = {
    ...memory,
    id: createId("memory"),
    createdAt: new Date().toISOString(),
  };

  saveVaultMemories([newMemory, ...memories]);
  return newMemory;
}

export function getUserMemories(userId) {
  return getVaultMemories().filter((memory) => memory.userId === userId);
}

export function deleteUserMemory(memoryId) {
  const memories = getVaultMemories().filter((memory) => memory.id !== memoryId);
  saveVaultMemories(memories);
}

export function deleteVaultAccount(accountId) {
  saveVaultAccounts(getVaultAccounts().filter((account) => account.id !== accountId));
  saveVaultMemories(getVaultMemories().filter((memory) => memory.userId !== accountId));
}
