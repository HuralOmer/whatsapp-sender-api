const licenseRepository = require("../repositories/licenseRepository");
const deviceRepository = require("../repositories/deviceRepository");
const usageRepository = require("../repositories/usageRepository");
const { writeLicenseLog } = require("../repositories/logRepository");
const { successResponse, errorResponse } = require("../utils/apiResponse");
const { getNowISOString, getTodayDateString, isExpiredDate } = require("../utils/date");
const { normalizeEmailValue, validateLicenseRequest } = require("../utils/validators");

function buildLogContext(data, license = null) {
  return {
    licenseId: license ? license.id : null,
    licenseKey: data ? data.licenseKey : null,
    deviceFingerprint: data ? data.deviceFingerprint : null,
    deviceName: data ? data.deviceName : null
  };
}

function getNormalizedLicenseEmail(license) {
  return normalizeEmailValue(license ? license.customer_email : "");
}

function normalizePositiveInteger(value) {
  const numberValue = Number(value || 0);
  return Number.isFinite(numberValue) && numberValue > 0 ? numberValue : 0;
}

function buildUsagePayload(plan, usageDate, usedToday) {
  const limit = normalizePositiveInteger(plan.daily_message_limit);

  return {
    usage_date: usageDate,
    used_today: usedToday,
    remaining_today: Math.max(limit - usedToday, 0)
  };
}

function buildSuccessPayload({ license, plan, device, usageDate, usedToday, customerEmail }) {
  return {
    license: {
      license_key: license.license_key,
      customer_email: customerEmail || getNormalizedLicenseEmail(license),
      status: license.status,
      expires_at: license.expires_at
    },
    plan: {
      name: plan.name,
      max_devices: normalizePositiveInteger(plan.max_devices),
      daily_message_limit: normalizePositiveInteger(plan.daily_message_limit)
    },
    device: {
      device_fingerprint: device.device_fingerprint,
      device_name: device.device_name,
      status: device.status
    },
    usage: buildUsagePayload(plan, usageDate, usedToday)
  };
}

function getLicenseStatusError(status) {
  if (status === "blocked") {
    return {
      code: "LICENSE_BLOCKED",
      message: "Lisansınız engellenmiştir. Lütfen destek ile iletişime geçin.",
      httpStatus: 403
    };
  }

  if (status === "expired") {
    return {
      code: "LICENSE_EXPIRED",
      message: "Lisans süreniz dolmuştur. Lütfen yeni lisans alın.",
      httpStatus: 401
    };
  }

  return {
    code: "LICENSE_INACTIVE",
    message: "Lisans aktif değildir.",
    httpStatus: 401
  };
}

function getDeviceStatusError(status) {
  if (status === "blocked") {
    return {
      code: "DEVICE_BLOCKED",
      message: "Bu cihaz için lisans kullanımı engellenmiştir.",
      httpStatus: 403
    };
  }

  return {
    code: "DEVICE_NOT_ACTIVE",
    message: "Bu cihaz lisans için aktif değildir.",
    httpStatus: 403
  };
}

async function logEvent(data, license, eventType, message, metadata = {}) {
  try {
    await writeLicenseLog({
      ...buildLogContext(data, license),
      eventType,
      message,
      metadata
    });
  } catch (error) {
    console.error("License log could not be written:", error);
  }
}

async function tryMarkLicenseExpired(licenseId) {
  try {
    await licenseRepository.markLicenseExpired(licenseId);
  } catch (error) {
    console.error("License status could not be marked as expired:", error);
  }
}

async function validateActiveLicenseAndPlan(data) {
  const license = await licenseRepository.findLicenseByKey(data.licenseKey);

  if (!license) {
    const message = "Lisans bulunamadı.";
    await logEvent(data, null, "LICENSE_NOT_FOUND", message);

    return {
      ok: false,
      response: errorResponse("LICENSE_NOT_FOUND", message, 401)
    };
  }

  const licenseCustomerEmail = getNormalizedLicenseEmail(license);

  if (!licenseCustomerEmail || licenseCustomerEmail !== data.customerEmail) {
    const message = "Lisans e-posta adresi eşleşmiyor.";
    await logEvent(data, license, "LICENSE_EMAIL_MISMATCH", message, {
      requested_customer_email: data.customerEmail
    });

    return {
      ok: false,
      response: errorResponse("LICENSE_EMAIL_MISMATCH", message, 401)
    };
  }

  if (license.status !== "active") {
    const statusError = getLicenseStatusError(license.status);
    await logEvent(data, license, statusError.code, statusError.message, {
      license_status: license.status
    });

    return {
      ok: false,
      response: errorResponse(statusError.code, statusError.message, statusError.httpStatus)
    };
  }

  if (isExpiredDate(license.expires_at)) {
    const message = "Lisans süreniz dolmuştur. Lütfen yeni lisans alın.";
    await tryMarkLicenseExpired(license.id);
    await logEvent(data, license, "LICENSE_EXPIRED", message, {
      expires_at: license.expires_at
    });

    return {
      ok: false,
      response: errorResponse("LICENSE_EXPIRED", message, 401)
    };
  }

  const plan = await licenseRepository.findPlanById(license.plan_id);

  if (!plan || plan.status !== "active") {
    const message = "Lisans planı aktif değildir.";
    await logEvent(data, license, "PLAN_NOT_ACTIVE", message, {
      plan_id: license.plan_id,
      plan_status: plan ? plan.status : null
    });

    return {
      ok: false,
      response: errorResponse("PLAN_NOT_ACTIVE", message, 403)
    };
  }

  return {
    ok: true,
    license,
    plan
  };
}

async function resolveActiveDevice(data, license, plan) {
  let device = await deviceRepository.findDeviceByLicenseAndFingerprint(
    license.id,
    data.deviceFingerprint
  );

  if (device) {
    if (device.status !== "active") {
      const deviceError = getDeviceStatusError(device.status);
      await logEvent(data, license, deviceError.code, deviceError.message, {
        device_status: device.status
      });

      return {
        ok: false,
        response: errorResponse(deviceError.code, deviceError.message, deviceError.httpStatus)
      };
    }

    device = await deviceRepository.updateDeviceLastSeen(
      device.id,
      data.deviceName,
      getNowISOString()
    );

    return {
      ok: true,
      device,
      registeredNewDevice: false
    };
  }

  const activeDeviceCount = await deviceRepository.countActiveDevicesByLicense(license.id);
  const maxDevices = normalizePositiveInteger(plan.max_devices);

  if (activeDeviceCount >= maxDevices) {
    const message = "Bu lisans için cihaz limiti dolmuştur.";
    await logEvent(data, license, "DEVICE_LIMIT_REACHED", message, {
      active_device_count: activeDeviceCount,
      max_devices: maxDevices
    });

    return {
      ok: false,
      response: errorResponse("DEVICE_LIMIT_REACHED", message, 403)
    };
  }

  device = await deviceRepository.createDevice({
    licenseId: license.id,
    deviceFingerprint: data.deviceFingerprint,
    deviceName: data.deviceName,
    createdAt: getNowISOString()
  });

  await logEvent(data, license, "DEVICE_REGISTERED", "Cihaz lisansa bağlandı.", {
    device_id: device.id
  });

  return {
    ok: true,
    device,
    registeredNewDevice: true
  };
}

async function runLicenseValidation(body, options) {
  const validation = validateLicenseRequest(body);

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
    const activeDevice = await resolveActiveDevice(data, license, plan);

    if (!activeDevice.ok) {
      return activeDevice.response;
    }

    const checkedAt = getNowISOString();
    const updatedLicense = await licenseRepository.updateLicenseLastCheck(license.id, checkedAt);
    const usageDate = getTodayDateString();
    const usage = await usageRepository.getOrCreateUsage(license.id, usageDate);
    const usedToday = normalizePositiveInteger(usage.sent_count);

    await logEvent(data, updatedLicense, options.successLogType, options.successMessage, {
      app_version: data.appVersion,
      customer_email: data.customerEmail,
      registered_new_device: activeDevice.registeredNewDevice
    });

    return successResponse(
      options.successCode,
      options.successMessage,
      buildSuccessPayload({
        license: updatedLicense,
        plan,
        device: activeDevice.device,
        usageDate,
        usedToday,
        customerEmail: data.customerEmail
      })
    );
  } catch (error) {
    console.error("License validation failed:", error);
    await logEvent(data, null, "INTERNAL_ERROR", "Lisans kontrolü sırasında beklenmeyen hata oluştu.", {
      error_message: error.message
    });

    return errorResponse("INTERNAL_ERROR", "Beklenmeyen bir hata oluştu.", 500);
  }
}

async function activateLicense(body) {
  return runLicenseValidation(body, {
    successCode: "LICENSE_ACTIVATED",
    successLogType: "LICENSE_ACTIVATED",
    successMessage: "Lisans başarıyla doğrulandı."
  });
}

async function checkLicense(body) {
  return runLicenseValidation(body, {
    successCode: "LICENSE_VALID",
    successLogType: "LICENSE_VALID",
    successMessage: "Lisans geçerli."
  });
}

module.exports = {
  activateLicense,
  checkLicense,
  validateActiveLicenseAndPlan,
  normalizePositiveInteger,
  buildUsagePayload,
  getDeviceStatusError,
  logEvent
};
