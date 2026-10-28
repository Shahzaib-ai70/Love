import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (request.method !== "GET") {
    return jsonResponse({ error: "Method not allowed." }, 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const adminUserIds = (Deno.env.get("ADMIN_USER_IDS") || "")
    .split(",")
    .map((userId) => userId.trim())
    .filter(Boolean);

  if (!supabaseUrl || !anonKey || !serviceRoleKey || !adminUserIds.length) {
    return jsonResponse({ error: "Cloud admin is not configured." }, 503);
  }

  const accessToken = request.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");

  if (!accessToken) {
    return jsonResponse({ error: "Sign in is required." }, 401);
  }

  const authClient = createClient(supabaseUrl, anonKey);
  const {
    data: { user },
    error: authError,
  } = await authClient.auth.getUser(accessToken);

  if (authError || !user) {
    return jsonResponse({ error: "Your session is invalid or expired." }, 401);
  }

  if (!adminUserIds.includes(user.id)) {
    return jsonResponse({ error: "This account is not authorized to view users." }, 403);
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
  const authUsers = [];
  const pageSize = 1000;

  for (let page = 1; ; page += 1) {
    const { data, error } = await adminClient.auth.admin.listUsers({
      page,
      perPage: pageSize,
    });

    if (error) {
      return jsonResponse({ error: "Could not load user accounts." }, 500);
    }

    authUsers.push(...data.users);

    if (data.users.length < pageSize) {
      break;
    }
  }

  const userIds = authUsers.map((authUser) => authUser.id);
  const profiles = new Map();
  const memoryCounts = new Map();
  const queryBatchSize = 100;

  for (let start = 0; start < userIds.length; start += queryBatchSize) {
    const userIdBatch = userIds.slice(start, start + queryBatchSize);
    const { data, error } = await adminClient
      .from("memory_profiles")
      .select("id, username, display_name, created_at")
      .in("id", userIdBatch);

    if (error || !data) {
      return jsonResponse({ error: "Could not load account profiles." }, 500);
    }

    for (const profile of data) {
      profiles.set(profile.id, profile);
    }
  }

  for (let start = 0; start < userIds.length; start += queryBatchSize) {
    const userIdBatch = userIds.slice(start, start + queryBatchSize);
    for (let offset = 0; ; offset += 1000) {
      const { data, error } = await adminClient
        .from("memory_entries")
        .select("user_id")
        .in("user_id", userIdBatch)
        .order("id")
        .range(offset, offset + 999);

      if (error || !data) {
        return jsonResponse({ error: "Could not load memory totals." }, 500);
      }

      for (const memory of data) {
        memoryCounts.set(memory.user_id, (memoryCounts.get(memory.user_id) || 0) + 1);
      }

      if (data.length < 1000) {
        break;
      }
    }
  }

  const users = authUsers.map((authUser) => {
    const profile = profiles.get(authUser.id);
    const username =
      profile?.username || authUser.user_metadata?.username || authUser.email?.split("@")[0] || "";

    return {
      id: authUser.id,
      username,
      displayName: profile?.display_name || authUser.user_metadata?.display_name || "",
      createdAt: profile?.created_at || authUser.created_at,
      memoryCount: memoryCounts.get(authUser.id) || 0,
    };
  });

  return jsonResponse({ users });
});
