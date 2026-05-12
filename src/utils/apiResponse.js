function successResponse(code, message, data = {}, httpStatus = 200) {
  return {
    httpStatus,
    body: {
      ok: true,
      code,
      message,
      ...data
    }
  };
}

function errorResponse(code, message, httpStatus = 400, data = {}) {
  return {
    httpStatus,
    body: {
      ok: false,
      code,
      message,
      ...data
    }
  };
}

function sendResponse(res, result) {
  return res.status(result.httpStatus).json(result.body);
}

function methodNotAllowed(res, allowedMethod = "POST") {
  res.setHeader("Allow", allowedMethod);

  return res.status(405).json({
    ok: false,
    code: "METHOD_NOT_ALLOWED",
    message: `Bu endpoint sadece ${allowedMethod} methodunu destekler.`
  });
}

module.exports = {
  successResponse,
  errorResponse,
  sendResponse,
  methodNotAllowed
};
