class AppError extends Error {
  constructor({
    status = 500,
    code = "INTERNAL_SERVER_ERROR",
    message = "Internal server error",
    details = {},
  } = {}) {
    super(message);

    this.name = "AppError";
    this.code = code;
    this.status = status;
    this.details = details;

    Error.captureStackTrace?.(this, this.constructor);
  }
}

module.exports = { AppError };
