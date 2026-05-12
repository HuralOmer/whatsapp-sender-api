const licenseRepository = require("../repositories/licenseRepository");
const deviceRepository = require("../repositories/deviceRepository");
const usageRepository = require("../repositories/usageRepository");
const { successResponse, errorResponse } = require("../utils/apiResponse");
const { getNowISOString, getTodayDateString } = require("../utils/date");
const { validateUsageIncrementRequest } = require("../utils/validators");
const {
  validateActiveLicenseAndPlan,
  normalizePositiveInteger,
  buildUsagePayload,
  getDeviceStatusError,
  logEvent
} = require("./licenseService");

async function incrementUsage(body) {
  const validation = validateUsageIncrementRequest(body);

  if (!validation.isValid) {
    return errorResponse("VALIDATION_ERROR", validation.message, 400);
  }

  const data = validation.data;

  try {
    const activeLicense = await validateActiveLicenseAndPlan(data);

    if (!activeLicense.ok) {
      return activeLicense.response;
    }

    const { license, plan } = activeLicense;
    const device = await deviceRepository.findDeviceByLicenseAndFingerprint(
      license.id,
      data.deviceFingerprint
    );

    if (!device) {
      const message = "Cihaz bu lisansa bağlı değildir.";
      await logEvent(data, license, "DEVICE_NOT_REGISTERED", message);

      return errorResponse("DEVICE_NOT_REGISTERED", message, 403);
    }

    if (device.status !== "active") {
      const deviceError = getDeviceStatusError(device.status);
      await logEvent(data, license, deviceError.code, deviceError.message, {
        device_status: device.status
      });

      return errorResponse(deviceError.code, deviceError.message, deviceError.httpStatus);
    }

    const checkedAt = getNowISOString();
    await licenseRepository.updateLicenseLastCheck(license.id, checkedAt);
    await deviceRepository.updateDeviceLastSeen(
      device.id,
      data.deviceName || device.device_name,
      checkedAt
    );

    const usageDate = getTodayDateString();
    const usage = await usageRepository.getOrCreateUsage(license.id, usageDate);
    const currentCount = normalizePositiveInteger(usage.sent_count);
    const dailyLimit = normalizePositiveInteger(plan.daily_message_limit);
    const currentUsagePayload = buildUsagePayload(plan, usageDate, currentCount);

    if (currentCount >= dailyLimit) {
      const message = "Günlük mesaj limitiniz dolmuştur.";
      await logEvent(data, license, "DAILY_LIMIT_REACHED", message, {
        sent_count: currentCount,
        daily_message_limit: dailyLimit
      });

      return errorResponse("DAILY_LIMIT_REACHED", message, 403, {
        usage: currentUsagePayload
      });
    }

    if (currentCount + data.incrementBy > dailyLimit) {
      const message = "Günlük mesaj limitiniz dolmuştur.";
      await logEvent(data, license, "DAILY_LIMIT_REACHED", message, {
        sent_count: currentCount,
        increment_by: data.incrementBy,
        daily_message_limit: dailyLimit
      });

      return errorResponse("DAILY_LIMIT_REACHED", message, 403, {
        usage: currentUsagePayload
      });
    }

    const updatedUsage = await usageRepository.incrementUsageCount(usage, data.incrementBy);
    const usedToday = normalizePositiveInteger(updatedUsage.sent_count);

    await logEvent(data, license, "USAGE_INCREMENTED", "Günlük kullanım güncellendi.", {
      app_version: data.appVersion,
      customer_email: data.customerEmail,
      increment_by: data.incrementBy,
      sent_count: usedToday
    });

    return successResponse("USAGE_INCREMENTED", "Günlük kullanım güncellendi.", {
      usage: buildUsagePayload(plan, usageDate, usedToday)
    });
  } catch (error) {
    console.error("Usage increment failed:", error);
    await logEvent(data, null, "INTERNAL_ERROR", "Kullanım güncellenirken beklenmeyen hata oluştu.", {
      error_message: error.message
    });

    return errorResponse("INTERNAL_ERROR", "Beklenmeyen bir hata oluştu.", 500);
  }
}

module.exports = {
  incrementUsage
};
