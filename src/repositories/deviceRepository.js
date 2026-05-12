const { getSupabaseClient } = require("../lib/supabaseClient");
const { getNowISOString } = require("../utils/date");

async function findDeviceByLicenseAndFingerprint(licenseId, deviceFingerprint) {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from("license_devices")
    .select("*")
    .eq("license_id", licenseId)
    .eq("device_fingerprint", deviceFingerprint)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
}

async function countActiveDevicesByLicense(licenseId) {
  const supabase = getSupabaseClient();

  const { count, error } = await supabase
    .from("license_devices")
    .select("id", { count: "exact", head: true })
    .eq("license_id", licenseId)
    .eq("status", "active");

  if (error) {
    throw error;
  }

  return count || 0;
}

async function createDevice({
  licenseId,
  deviceFingerprint,
  deviceName,
  createdAt = getNowISOString()
}) {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from("license_devices")
    .insert({
      license_id: licenseId,
      device_fingerprint: deviceFingerprint,
      device_name: deviceName || null,
      status: "active",
      first_activated_at: createdAt,
      last_seen_at: createdAt,
      updated_at: createdAt
    })
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  return data;
}

async function updateDeviceLastSeen(deviceId, deviceName, lastSeenAt = getNowISOString()) {
  const supabase = getSupabaseClient();
  const updatePayload = {
    last_seen_at: lastSeenAt,
    updated_at: lastSeenAt
  };

  if (deviceName) {
    updatePayload.device_name = deviceName;
  }

  const { data, error } = await supabase
    .from("license_devices")
    .update(updatePayload)
    .eq("id", deviceId)
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  return data;
}

module.exports = {
  findDeviceByLicenseAndFingerprint,
  countActiveDevicesByLicense,
  createDevice,
  updateDeviceLastSeen
};
