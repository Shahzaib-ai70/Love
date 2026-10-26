const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.replace(/\/+$/, "") || "";
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || "";
const SESSION_KEY = "love-supabase-session-v1";

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

function readSession() {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const rawValue = window.localStorage.getItem(SESSION_KEY);
    return rawValue ? JSON.parse(rawValue) : null;
  } catch (error) {
    console.error("Could not read Supabase session.", error);
    return null;
  }
}

export function getSupabaseSession() {
  return readSession();
}

export function saveSupabaseSession(session) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export function clearSupabaseSession() {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(SESSION_KEY);
}

export function getSupabasePublicFileUrl(bucketName, filePath) {
  return `${supabaseUrl}/storage/v1/object/public/${bucketName}/${filePath}`;
}

export async function supabaseRequest(
  path,
  { method = "GET", headers = {}, body, accessToken } = {}
) {
  if (!isSupabaseConfigured) {
    throw new Error("Supabase is not configured.");
  }

  const requestHeaders = {
    apikey: supabaseAnonKey,
    ...headers,
  };

  if (accessToken) {
    requestHeaders.Authorization = `Bearer ${accessToken}`;
  }

  let requestBody = body;

  if (
    body !== undefined &&
    body !== null &&
    !(body instanceof Blob) &&
    !(body instanceof FormData) &&
    !requestHeaders["Content-Type"]
  ) {
    requestHeaders["Content-Type"] = "application/json";
    requestBody = JSON.stringify(body);
  }

  const response = await fetch(`${supabaseUrl}${path}`, {
    method,
    headers: requestHeaders,
    body: requestBody,
  });

  const contentType = response.headers.get("content-type") || "";
  const payload = contentType.includes("application/json")
    ? await response.json()
    : await response.text();

  if (!response.ok) {
    const message =
      typeof payload === "string"
        ? payload
        : payload?.msg || payload?.message || payload?.error_description || payload?.error;
    throw new Error(message || `Supabase request failed with status ${response.status}.`);
  }

  return payload;
}

export async function signUpSupabase({ email, password, data }) {
  const payload = await supabaseRequest("/auth/v1/signup", {
    method: "POST",
    body: {
      email,
      password,
      data,
    },
  });

  if (payload?.access_token) {
    saveSupabaseSession(payload);
  }

  return payload;
}

export async function signInWithPasswordSupabase({ email, password }) {
  const payload = await supabaseRequest("/auth/v1/token?grant_type=password", {
    method: "POST",
    body: {
      email,
      password,
    },
  });

  if (payload?.access_token) {
    saveSupabaseSession(payload);
  }

  return payload;
}

export async function getSupabaseUser() {
  const session = readSession();

  if (!session?.access_token) {
    return null;
  }

  try {
    return await supabaseRequest("/auth/v1/user", {
      accessToken: session.access_token,
    });
  } catch (error) {
    clearSupabaseSession();

    if (error instanceof Error && /jwt|token|expired|invalid/i.test(error.message)) {
      return null;
    }

    throw error;
  }
}

export async function signOutSupabase() {
  const session = readSession();

  if (!session?.access_token) {
    clearSupabaseSession();
    return;
  }

  try {
    await supabaseRequest("/auth/v1/logout", {
      method: "POST",
      accessToken: session.access_token,
    });
  } finally {
    clearSupabaseSession();
  }
}
