import {
  createVaultAccount as createLocalVaultAccount,
  deleteUserMemory as deleteLocalUserMemory,
  getCurrentVaultUser as getLocalCurrentVaultUser,
  getUserMemories as getLocalUserMemories,
  saveUserMemory as saveLocalUserMemory,
  signInVaultAccount as signInLocalVaultAccount,
  signOutVaultAccount as signOutLocalVaultAccount,
} from "./localMemoryVault";
import {
  getSupabasePublicFileUrl,
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

function mapCloudMemory(memory) {
  return {
    id: memory.id,
    userId: memory.user_id,
    title: memory.title,
    text: memory.text || "",
    mediaUrl: memory.media_url || "",
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
      mediaUrl: getSupabasePublicFileUrl(MEDIA_BUCKET, filePath),
    };
  } catch (error) {
    throw toFriendlyCloudError(error, "Could not upload the selected file.");
  }
}

async function createCloudVaultAccount({ displayName, username, password }) {
  const normalizedUsername = normalizeUsername(username);
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
        },
      ],
    });

    return mapCloudMemory(rows[0]);
  } catch (error) {
    throw toFriendlyCloudError(error, "Could not save this memory.");
  }
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

    return rows.map(mapCloudMemory);
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
