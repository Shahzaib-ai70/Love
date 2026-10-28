import {
  createVaultAccount as createLocalVaultAccount,
  deleteUserMemory as deleteLocalUserMemory,
  getCurrentVaultUser as getLocalCurrentVaultUser,
  getUserMemories as getLocalUserMemories,
  getVaultAccounts,
  saveUserMemory as saveLocalUserMemory,
  signInVaultAccount as signInLocalVaultAccount,
  signOutVaultAccount as signOutLocalVaultAccount,
} from "./localMemoryVault";
import {
  getSupabaseSignedFileUrl,
  getSupabaseSession,
  getSupabaseUser,
  isSupabaseConfigured,
  signInWithPasswordSupabase,
  signOutSupabase,
  signUpSupabase,
  supabaseRequest,
} from "./lib/supabaseClient";

const PROFILE_TABLE = "memory_profiles";
const MEMORIES_TABLE = "memory_entries";
const MEDIA_BUCKET = "memory-media";

function normalizeUsername(username) {
  return username.trim().toLowerCase();
}

function buildVaultEmail(username) {
  return `${normalizeUsername(username)}@love-memories.app`;
}

function validateCloudUsername(username) {
  if (!/^[a-z0-9][a-z0-9._-]{2,31}$/i.test(username)) {
    throw new Error("Use a username with 3-32 letters, numbers, dots, underscores, or hyphens.");
  }
}

function slugify(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

function guessFileExtension(fileName, mimeType) {
  const extensionFromName = fileName.split(".").pop()?.trim().toLowerCase();

  if (extensionFromName && extensionFromName !== fileName.toLowerCase()) {
    return extensionFromName;
  }

  if (mimeType === "video/webm") {
    return "webm";
  }

  if (mimeType === "video/ogg") {
    return "ogg";
  }

  if (mimeType === "video/mp4") {
    return "mp4";
  }

  if (mimeType === "image/png") {
    return "png";
  }

  if (mimeType === "image/jpeg") {
    return "jpg";
  }

  if (mimeType === "image/webp") {
    return "webp";
  }

  if (mimeType === "image/gif") {
    return "gif";
  }

  return "bin";
}

function dataUrlToBlob(dataUrl) {
  const [header, encodedData = ""] = dataUrl.split(",");
  const mimeType = header.match(/data:(.*?);base64/i)?.[1] || "application/octet-stream";
  const binaryString = window.atob(encodedData);
  const bytes = new Uint8Array(binaryString.length);

  for (let index = 0; index < binaryString.length; index += 1) {
    bytes[index] = binaryString.charCodeAt(index);
  }

  return new Blob([bytes], { type: mimeType });
}

function mapCloudProfile(profile) {
  return {
    id: profile.id,
    username: profile.username,
    displayName: profile.display_name || "",
    createdAt: profile.created_at,
  };
}

async function mapCloudMemory(memory) {
  const mediaUrl = memory.media_path
    ? await getSupabaseSignedFileUrl(MEDIA_BUCKET, memory.media_path, getAccessToken())
    : memory.media_url || "";

  return {
    id: memory.id,
    userId: memory.user_id,
    title: memory.title,
    text: memory.text || "",
    mediaUrl,
    mediaData: "",
    mediaFileName: memory.media_file_name || "",
    mediaType: memory.media_type || "text",
    createdAt: memory.created_at,
  };
}

function toFriendlyCloudError(error, fallbackMessage) {
  const message = error instanceof Error ? error.message : fallbackMessage;

  if (/invalid api key|jwt/i.test(message)) {
    return new Error("Supabase keys are invalid. Check the values in your `.env` file.");
  }

  if (/relation .* does not exist|bucket .* not found|row-level security|permission denied/i.test(message)) {
    return new Error("Supabase is connected, but the tables, bucket, or policies are not ready yet. Finish `SUPABASE_SETUP.md`.");
  }

  if (/email not confirmed/i.test(message)) {
    return new Error("Disable email confirmation in Supabase Auth, then create the account again.");
  }

  return new Error(message || fallbackMessage);
}

function getAccessToken() {
  return getSupabaseSession()?.access_token || "";
}

async function ensureCloudProfile(user, fallbackDisplayName = "") {
  const username =
    normalizeUsername(user.user_metadata?.username || user.email?.split("@")[0] || "");
  const displayName = String(
    user.user_metadata?.display_name || fallbackDisplayName || ""
  ).trim();

  try {
    const rows = await supabaseRequest(`/rest/v1/${PROFILE_TABLE}?on_conflict=id`, {
      method: "POST",
      accessToken: getAccessToken(),
      headers: {
        Prefer: "resolution=merge-duplicates,return=representation",
      },
      body: [
        {
          id: user.id,
          username,
          display_name: displayName,
        },
      ],
    });

    return mapCloudProfile(rows[0]);
  } catch (error) {
    throw toFriendlyCloudError(error, "Could not save the user profile.");
  }
}

async function uploadCloudMedia(userId, memory) {
  if (!memory.mediaData) {
    return {
      mediaPath: "",
      mediaUrl: memory.mediaUrl?.trim() || "",
    };
  }

  const blob = dataUrlToBlob(memory.mediaData);
  const extension = guessFileExtension(memory.mediaFileName || memory.title, blob.type);
  const baseName = slugify(memory.mediaFileName || memory.title || "memory-file") || "memory-file";
  const filePath = `${userId}/${Date.now()}-${baseName}.${extension}`;

  try {
    await supabaseRequest(`/storage/v1/object/${MEDIA_BUCKET}/${filePath}`, {
      method: "POST",
      accessToken: getAccessToken(),
      headers: {
        "Content-Type": blob.type || "application/octet-stream",
        "x-upsert": "false",
      },
      body: blob,
    });

    return {
      mediaPath: filePath,
      mediaUrl: "",
    };
  } catch (error) {
    throw toFriendlyCloudError(error, "Could not upload the selected file.");
  }
}

async function createCloudVaultAccount({ displayName, username, password }) {
  const normalizedUsername = normalizeUsername(username);
  validateCloudUsername(normalizedUsername);

  if (password.length < 6) {
    throw new Error("Use a password with at least 6 characters for your cloud account.");
  }

  const email = buildVaultEmail(normalizedUsername);
  const trimmedDisplayName = displayName.trim();

  try {
    const data = await signUpSupabase({
      email,
      password,
      data: {
        username: normalizedUsername,
        display_name: trimmedDisplayName,
      },
    });

    if (!data?.access_token) {
      await signInWithPasswordSupabase({
        email,
        password,
      });
    }

    return getCurrentVaultUser();
  } catch (error) {
    throw toFriendlyCloudError(error, "Could not create the account.");
  }
}

async function signInCloudVaultAccount({ username, password }) {
  try {
    await signInWithPasswordSupabase({
      email: buildVaultEmail(username),
      password,
    });

    return getCurrentVaultUser();
  } catch (error) {
    throw toFriendlyCloudError(error, "Wrong username or password.");
  }
}

async function getCloudCurrentVaultUser() {
  try {
    const user = await getSupabaseUser();

    if (!user) {
      return null;
    }

    return ensureCloudProfile(user);
  } catch (error) {
    throw toFriendlyCloudError(error, "Could not read the current Supabase session.");
  }
}

async function signOutCloudVaultAccount() {
  try {
    await signOutSupabase();
  } catch (error) {
    throw toFriendlyCloudError(error, "Could not sign out.");
  }
}

async function saveCloudUserMemory(memory) {
  const currentUser = await getCloudCurrentVaultUser();

  if (!currentUser) {
    throw new Error("Sign in first to save a private memory.");
  }

  const uploadedMedia = await uploadCloudMedia(currentUser.id, memory);

  try {
    const rows = await supabaseRequest(`/rest/v1/${MEMORIES_TABLE}`, {
      method: "POST",
      accessToken: getAccessToken(),
      headers: {
        Prefer: "return=representation",
      },
      body: [
        {
          user_id: currentUser.id,
          title: memory.title.trim(),
          text: memory.text.trim(),
          media_url: uploadedMedia.mediaUrl || memory.mediaUrl.trim() || null,
          media_path: uploadedMedia.mediaPath || null,
          media_type: memory.mediaType || "text",
          media_file_name: memory.mediaFileName || null,
          source_local_id: memory.sourceLocalId || null,
        },
      ],
    });

    return mapCloudMemory(rows[0]);
  } catch (error) {
    throw toFriendlyCloudError(error, "Could not save this memory.");
  }
}

async function importLocalMemoriesToCloud() {
  const currentUser = await getCloudCurrentVaultUser();

  if (!currentUser) {
    throw new Error("Sign in first to import browser memories.");
  }

  const localAccount = getVaultAccounts().find(
    (account) => account.username === normalizeUsername(currentUser.username)
  );

  if (!localAccount) {
    throw new Error("No browser-local account with this username was found on this device.");
  }

  const localMemories = getLocalUserMemories(localAccount.id);
  let importedCount = 0;

  for (const memory of localMemories) {
    const existingRows = await supabaseRequest(
      `/rest/v1/${MEMORIES_TABLE}?user_id=eq.${encodeURIComponent(
        currentUser.id
      )}&source_local_id=eq.${encodeURIComponent(memory.id)}&select=id&limit=1`,
      {
        accessToken: getAccessToken(),
      }
    );

    if (existingRows.length) {
      continue;
    }

    await saveCloudUserMemory({
      ...memory,
      userId: currentUser.id,
      sourceLocalId: memory.id,
    });
    importedCount += 1;
  }

  return {
    importedCount,
    totalCount: localMemories.length,
  };
}

async function getCloudUserMemories(userId) {
  try {
    const rows = await supabaseRequest(
      `/rest/v1/${MEMORIES_TABLE}?user_id=eq.${encodeURIComponent(
        userId
      )}&select=*&order=created_at.desc`,
      {
        accessToken: getAccessToken(),
      }
    );

    return Promise.all(rows.map(mapCloudMemory));
  } catch (error) {
    throw toFriendlyCloudError(error, "Could not load saved memories.");
  }
}

async function deleteCloudUserMemory(memoryId) {
  const currentUser = await getCloudCurrentVaultUser();

  if (!currentUser) {
    throw new Error("Sign in first to manage memories.");
  }

  let memory = null;

  try {
    memory = await supabaseRequest(
      `/rest/v1/${MEMORIES_TABLE}?id=eq.${encodeURIComponent(
        memoryId
      )}&user_id=eq.${encodeURIComponent(currentUser.id)}&select=id,media_path`,
      {
        accessToken: getAccessToken(),
        headers: {
          Accept: "application/vnd.pgrst.object+json",
        },
      }
    );
  } catch (error) {
    throw toFriendlyCloudError(error, "Could not find this memory.");
  }

  if (memory?.media_path) {
    try {
      await supabaseRequest(`/storage/v1/object/${MEDIA_BUCKET}/${memory.media_path}`, {
        method: "DELETE",
        accessToken: getAccessToken(),
      });
    } catch (error) {
      throw toFriendlyCloudError(error, "Could not remove the memory file.");
    }
  }

  try {
    await supabaseRequest(
      `/rest/v1/${MEMORIES_TABLE}?id=eq.${encodeURIComponent(
        memoryId
      )}&user_id=eq.${encodeURIComponent(currentUser.id)}`,
      {
        method: "DELETE",
        accessToken: getAccessToken(),
      }
    );
  } catch (error) {
    throw toFriendlyCloudError(error, "Could not delete this memory.");
  }
}

export function getMemoryStorageMode() {
  return isSupabaseConfigured ? "cloud" : "local";
}

export async function createVaultAccount(payload) {
  if (!isSupabaseConfigured) {
    return createLocalVaultAccount(payload);
  }

  return createCloudVaultAccount(payload);
}

export async function signInVaultAccount(payload) {
  if (!isSupabaseConfigured) {
    return signInLocalVaultAccount(payload);
  }

  return signInCloudVaultAccount(payload);
}

export async function getCurrentVaultUser() {
  if (!isSupabaseConfigured) {
    return getLocalCurrentVaultUser();
  }

  return getCloudCurrentVaultUser();
}

export async function signOutVaultAccount() {
  if (!isSupabaseConfigured) {
    signOutLocalVaultAccount();
    return;
  }

  await signOutCloudVaultAccount();
}

export async function saveUserMemory(memory) {
  if (!isSupabaseConfigured) {
    return saveLocalUserMemory(memory);
  }

  return saveCloudUserMemory(memory);
}

export async function getUserMemories(userId) {
  if (!isSupabaseConfigured) {
    return getLocalUserMemories(userId);
  }

  return getCloudUserMemories(userId);
}

export async function deleteUserMemory(memoryId) {
  if (!isSupabaseConfigured) {
    deleteLocalUserMemory(memoryId);
    return;
  }

  await deleteCloudUserMemory(memoryId);
}

export async function importLocalMemories() {
  if (!isSupabaseConfigured) {
    throw new Error("Configure Supabase before importing browser memories.");
  }

  try {
    return await importLocalMemoriesToCloud();
  } catch (error) {
    throw toFriendlyCloudError(error, "Could not import browser memories.");
  }
}

export async function getCloudAdminUsers() {
  if (!isSupabaseConfigured) {
    throw new Error("Configure Supabase before opening cloud admin.");
  }

  const accessToken = getAccessToken();

  if (!accessToken) {
    throw new Error("Sign in with your admin account first.");
  }

  try {
    return await supabaseRequest("/functions/v1/admin-users", {
      accessToken,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";

    if (/403|not authorized|not an admin/i.test(message)) {
      throw new Error("This account is not authorized to view the user list.");
    }

    if (/404|not found/i.test(message)) {
      throw new Error("Deploy the admin-users Supabase Edge Function to enable cloud admin.");
    }

    throw toFriendlyCloudError(error, "Could not load cloud users.");
  }
}
