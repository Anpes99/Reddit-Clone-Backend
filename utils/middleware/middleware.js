const jwt = require("jsonwebtoken");
const {
  hasSubredditPermission,
} = require("../../config/subreddit-moderator-permissions");
const { SubredditModerators } = require("../../models/index");
const pinoHttp = require("pino-http");
const logger = require("../logger");
const { AppError } = require("../../errors");

const unknownEndpoint = (request, response) => {
  throw new AppError({
    status: 404,
    code: "UNKNOWN_ENDPOINT",
    message: "unknown endpoint",
    details: {},
  });
};

const tokenExtractor = (request, response, next) => {
  const authorization = request.get("authorization");
  if (authorization && authorization.toLowerCase().startsWith("bearer ")) {
    request.token = authorization.substring(7);
  }
  next();
};

const userExtractor = (req, res, next) => {
  const authorization = req.get("authorization");

  if (authorization && authorization.toLowerCase().startsWith("bearer ")) {
    const token = authorization.substring(7);

    const decodedToken = jwt.verify(token, process.env.SECRET);
    req.user = { username: decodedToken.username, id: decodedToken.id };
  }

  next();
};

const requireAuth = (req, res, next) => {
  if (!req.user) {
    throw new AppError({
      status: 401,
      code: "AUTHENTICATION_REQUIRED",
      message: "Authentication required",
      details: {},
    });
  }

  next();
};

const errorHandler = (error, request, response, next) => {
  if (response.headersSent) {
    return next(error);
  }
  if (error instanceof AppError) {
    return response.status(error.status).send({
      code: error.code,
      message: error.message,
      details: error.details,
    });
  }

  if (error.name === "ValidationError") {
    return response.status(400).send({
      code: "VALIDATION_ERROR",
      message: error.message,
      details: {},
    });
  }
  if (error.name === "TokenExpiredError") {
    return response.status(401).send({
      code: "TOKEN_EXPIRED_ERROR",
      message: error.message,
      details: {},
    });
  }
  if (error.name === "JsonWebTokenError") {
    return response.status(401).send({
      code: "JWT_ERROR",
      message: error.message,
      details: {},
    });
  }

  logger.error(error);

  return response.status(500).send({
    code: "INTERNAL_SERVER_ERROR",
    message: "something went wrong",
    details: {},
  });
};

const validate = (schema, property = "body") => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req[property], {
      abortEarly: true,
      allowUnknown: false,
    });

    if (error) {
      throw new AppError({
        status: 400,
        code: "VALIDATION_FAILED",
        message: "validation failed",
        details: {},
      });
    }

    req[property] = value;
    next();
  };
};

const requireSubredditPermission = (permission) => {
  return async (req, res, next) => {
    const userId = req.user?.id;
    const subredditId = req.params.subredditId;

    if (!userId) {
      throw new AppError({
        status: 401,
        code: "UNAUTHORIZED",
        message: "unauthorized",
        details: {},
      });
    }

    const moderator = await SubredditModerators.findOne({
      where: {
        subredditId,
        userId,
      },
      attributes: ["role"],
    });
    if (!moderator || !hasSubredditPermission(moderator.role, permission)) {
      throw new AppError({
        status: 403,
        code: "FORBIDDEN",
        message: "Forbidden",
        details: {},
      });
    }

    next();
  };
};

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

const csrfProtection = (req, res, next) => {
  if (SAFE_METHODS.has(req.method)) {
    return next();
  }

  const origin = req.get("Origin");

  const allowedOrigin = process.env.CLIENT_URL;

  if (origin !== allowedOrigin) {
    throw new AppError({
      status: 403,
      code: "INVALID_REQUEST_ORIGIN",
      message: "Invalid request origin",
      details: {},
    });
  }

  next();
};

const httpLogger = pinoHttp({
  logger,

  serializers: {
    req(req) {
      return {
        method: req.method,
        url: req.url,
        remoteAddress: req.remoteAddress,
      };
    },

    res(res) {
      return {
        statusCode: res.statusCode,
      };
    },
  },

  customSuccessMessage(req, res) {
    return `${req.method} ${req.url} completed`;
  },

  customErrorMessage(req, res, err) {
    return `${req.method} ${req.url} failed`;
  },
});

module.exports = {
  errorHandler,
  tokenExtractor,
  userExtractor,
  unknownEndpoint,
  validate,
  requireAuth,
  requireSubredditPermission,
  csrfProtection,
  httpLogger,
};
