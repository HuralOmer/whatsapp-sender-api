const LIMITS = {
  licenseKey: 100,
  deviceFingerprint: 300,
  deviceName: 200,
  appVersion: 50
};

function normalizeRequiredString(value, fieldName, maxLength, options = {}) {
  if (typeof value !== "string") {
    return {
      error: `${fieldName} zorunludur.`
    };
  }

  const normalized = options.uppercase ? value.trim().toUpperCase() : value.trim();

  if (!normalized) {
    return {
      error: `${fieldName} bos olamaz.`
    };
  }

  if (normalized.length > maxLength) {
    return {
      error: `${fieldName} en fazla ${maxLength} karakter olabilir.`
    };
  }

  return {
    value: normalized
  };
}

function normalizeOptionalString(value, fieldName, maxLength) {
  if (value === undefined || value === null) {
    return {
      value: null
    };
  }

  if (typeof value !== "string") {
    return {
      error: `${fieldName} metin olmalidir.`
    };
  }

  const normalized = value.trim();

  if (!normalized) {
    return {
      value: null
    };
  }

  if (normalized.length > maxLength) {
    return {
      error: `${fieldName} en fazla ${maxLength} karakter olabilir.`
    };
  }

  return {
    value: normalized
  };
}

function validateBaseLicensePayload(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return {
      isValid: false,
      message: "Gecerli bir JSON body gonderilmelidir."
    };
  }

  const licenseKey = normalizeRequiredString(
    body.license_key,
    "license_key",
    LIMITS.licenseKey,
    { uppercase: true }
  );

  if (licenseKey.error) {
    return {
      isValid: false,
      message: licenseKey.error
    };
  }

  const deviceFingerprint = normalizeRequiredString(
    body.device_fingerprint,
    "device_fingerprint",
    LIMITS.deviceFingerprint
  );

  if (deviceFingerprint.error) {
    return {
      isValid: false,
      message: deviceFingerprint.error
    };
  }

  const deviceName = normalizeOptionalString(body.device_name, "device_name", LIMITS.deviceName);

  if (deviceName.error) {
    return {
      isValid: false,
      message: deviceName.error
    };
  }

  const appVersion = normalizeOptionalString(body.app_version, "app_version", LIMITS.appVersion);

  if (appVersion.error) {
    return {
      isValid: false,
      message: appVersion.error
    };
  }

  return {
    isValid: true,
    data: {
      licenseKey: licenseKey.value,
      deviceFingerprint: deviceFingerprint.value,
      deviceName: deviceName.value,
      appVersion: appVersion.value
    }
  };
}

function validateLicenseRequest(body) {
  return validateBaseLicensePayload(body);
}

function validateUsageIncrementRequest(body) {
  const baseValidation = validateBaseLicensePayload(body);

  if (!baseValidation.isValid) {
    return baseValidation;
  }

  const rawIncrementBy = body.increment_by === undefined || body.increment_by === null
    ? 1
    : Number(body.increment_by);

  if (!Number.isInteger(rawIncrementBy)) {
    return {
      isValid: false,
      message: "increment_by tam sayi olmalidir."
    };
  }

  if (rawIncrementBy < 1) {
    return {
      isValid: false,
      message: "increment_by 1'den kucuk olamaz."
    };
  }

  if (rawIncrementBy > 10) {
    return {
      isValid: false,
      message: "increment_by ilk surumde en fazla 10 olabilir."
    };
  }

  return {
    isValid: true,
    data: {
      ...baseValidation.data,
      incrementBy: rawIncrementBy
    }
  };
}

module.exports = {
  validateLicenseRequest,
  validateUsageIncrementRequest
};
