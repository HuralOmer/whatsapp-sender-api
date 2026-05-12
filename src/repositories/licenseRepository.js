const { getSupabaseClient } = require("../lib/supabaseClient");
const { getNowISOString } = require("../utils/date");

async function findLicenseByKey(licenseKey) {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from("licenses")
    .select("*")
    .eq("license_key", licenseKey)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
}

async function findPlanById(planId) {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from("plans")
    .select("*")
    .eq("id", planId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
}

async function updateLicenseLastCheck(licenseId, checkedAt = getNowISOString()) {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from("licenses")
    .update({
      last_check_at: checkedAt,
      updated_at: checkedAt
    })
    .eq("id", licenseId)
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  return data;
}

async function markLicenseExpired(licenseId, expiredAt = getNowISOString()) {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from("licenses")
    .update({
      status: "expired",
      updated_at: expiredAt
    })
    .eq("id", licenseId)
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  return data;
}

module.exports = {
  findLicenseByKey,
  findPlanById,
  updateLicenseLastCheck,
  markLicenseExpired
};
