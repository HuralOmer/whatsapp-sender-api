const { getSupabaseClient } = require("../lib/supabaseClient");

async function writeLicenseLog({
  licenseId = null,
  licenseKey = null,
  deviceFingerprint = null,
  deviceName = null,
  eventType,
  message,
  metadata = {}
}) {
  try {
    const supabase = getSupabaseClient();

    const { error } = await supabase
      .from("license_logs")
      .insert({
        license_id: licenseId,
        license_key: licenseKey,
        device_fingerprint: deviceFingerprint,
        device_name: deviceName,
        event_type: eventType,
        message,
        metadata
      });

    if (error) {
      throw error;
    }
  } catch (error) {
    console.error("License log write failed:", error);
  }
}

module.exports = {
  writeLicenseLog
};
