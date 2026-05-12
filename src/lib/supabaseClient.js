const { createClient } = require("@supabase/supabase-js");
const { validateEnv } = require("../config/env");

let supabaseClient;

function getSupabaseClient() {
  if (!supabaseClient) {
    const env = validateEnv();

    supabaseClient = createClient(env.supabaseUrl, env.supabaseServiceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false
      }
    });
  }

  return supabaseClient;
}

module.exports = {
  getSupabaseClient
};
