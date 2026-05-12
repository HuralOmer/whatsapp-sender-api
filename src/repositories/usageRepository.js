const { getSupabaseClient } = require("../lib/supabaseClient");
const { getNowISOString } = require("../utils/date");

async function findUsageByLicenseAndDate(licenseId, usageDate) {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from("license_daily_usage")
    .select("*")
    .eq("license_id", licenseId)
    .eq("usage_date", usageDate)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
}

async function createUsage(licenseId, usageDate, createdAt = getNowISOString()) {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from("license_daily_usage")
    .insert({
      license_id: licenseId,
      usage_date: usageDate,
      sent_count: 0,
      created_at: createdAt,
      updated_at: createdAt
    })
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  return data;
}

async function getOrCreateUsage(licenseId, usageDate) {
  const existingUsage = await findUsageByLicenseAndDate(licenseId, usageDate);

  if (existingUsage) {
    return existingUsage;
  }

  try {
    return await createUsage(licenseId, usageDate);
  } catch (error) {
    if (error && error.code === "23505") {
      return findUsageByLicenseAndDate(licenseId, usageDate);
    }

    throw error;
  }
}

async function updateUsageCount(usageId, sentCount, updatedAt = getNowISOString()) {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from("license_daily_usage")
    .update({
      sent_count: sentCount,
      updated_at: updatedAt
    })
    .eq("id", usageId)
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  return data;
}

async function incrementUsageCount(usage, incrementBy, updatedAt = getNowISOString()) {
  // TODO: production’da usage increment için Supabase RPC veya transaction benzeri atomik yöntem eklenmeli.
  const currentCount = Number(usage.sent_count || 0);
  const nextCount = currentCount + incrementBy;

  return updateUsageCount(usage.id, nextCount, updatedAt);
}

module.exports = {
  findUsageByLicenseAndDate,
  createUsage,
  getOrCreateUsage,
  updateUsageCount,
  incrementUsageCount
};
