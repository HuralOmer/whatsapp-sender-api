const { incrementUsage } = require("../../src/services/usageService");
const { sendResponse, methodNotAllowed, errorResponse } = require("../../src/utils/apiResponse");

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    return methodNotAllowed(res, "POST");
  }

  try {
    const result = await incrementUsage(req.body);
    return sendResponse(res, result);
  } catch (error) {
    console.error("Unhandled usage increment endpoint error:", error);

    return sendResponse(
      res,
      errorResponse("INTERNAL_ERROR", "Beklenmeyen bir hata oluştu.", 500)
    );
  }
};
