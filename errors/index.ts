type AppErrorOptions = {
  status?: number;
  code?: string;
  message?: string;
  details?: Record<string, unknown>;
};

export class AppError extends Error {
  declare status: number;
  declare code: string;
  declare details: Record<string, unknown>;

  constructor({
    status = 500,
    code = "INTERNAL_SERVER_ERROR",
    message = "Internal server error",
    details = {},
  }: AppErrorOptions = {}) {
    super(message);

    this.name = "AppError";
    this.code = code;
    this.status = status;
    this.details = details;

    Error.captureStackTrace?.(this, this.constructor);
  }
}
