function getNowISOString() {
  return new Date().toISOString();
}

function getTodayDateString(date = new Date()) {
  // TODO: Ileride lisans/kullanici timezone destegi eklendiginde bu hesaplama genisletilmeli.
  return date.toISOString().slice(0, 10);
}

function isExpiredDate(dateValue) {
  if (!dateValue) {
    return false;
  }

  const expiresAt = new Date(dateValue).getTime();

  if (Number.isNaN(expiresAt)) {
    return false;
  }

  return expiresAt < Date.now();
}

module.exports = {
  getNowISOString,
  getTodayDateString,
  isExpiredDate
};
