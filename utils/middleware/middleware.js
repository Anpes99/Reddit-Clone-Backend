const jwt = require("jsonwebtoken");
const {
  hasSubredditPermission,
} = require("../../config/subreddit-moderator-permissions");
const { SubredditModerators } = require("../../models/index");

const unknownEndpoint = (request, response) => {
  response.status(404).send({ error: "unknown endpoint" });
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
    try {
      const decodedToken = jwt.verify(token, process.env.SECRET);
      req.user = { username: decodedToken.username, id: decodedToken.id };
    } catch (e) {
      return next(e);
    }
  }

  next();
};

const requireAuth = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      error: "Authentication required",
    });
  }

  next();
};

const errorHandler = (error, request, response, next) => {
  if (error.name === "ValidationError") {
    console.error(error.message);
    return response
      .status(400)
      .send({ error: { message: error.message, name: error.name } });
  }
  if (error.name === "TokenExpiredError") {
    return response
      .status(401)
      .send({ error: { message: error.message, name: error.name } });
  }
  if (error.name === "JsonWebTokenError") {
    return response
      .status(401)
      .send({ error: { message: error.message, name: error.name } });
  }
  if (error.name === "TypeError") {
    console.error(error.message);
    return response
      .status(500)
      .send({ error: { message: error.message, name: error.name } });
  }
  if (error.name === "CastError") {
    console.error(error.message);
    return response
      .status(400)
      .send({ error: { message: error.message, name: error.name } });
  }

  next(error);
};

const validate = (schema, property = "body") => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req[property], {
      abortEarly: true,
      allowUnknown: false,
    });

    if (error) {
      console.log(error.details);
      return res.status(400).json({
        message: "Validation failed",
        details: error.details,
      });
    }

    req[property] = value;
    next();
  };
};

const requireSubredditPermission = (permission) => {
  return async (req, res, next) => {
    try {
      const userId = req.user?.id;
      const subredditId = req.params.subredditId;

      if (!userId) {
        return res.status(401).json({
          error: "Unauthorized",
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
        return res.status(403).json({
          error: "Forbidden",
        });
      }

      next();
    } catch (err) {
      next(err);
    }
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
    return res.status(403).json({
      error: {
        message: "Invalid request origin",
        name: "CsrfError",
      },
    });
  }

  next();
};

module.exports = {
  errorHandler,
  tokenExtractor,
  userExtractor,
  unknownEndpoint,
  validate,
  requireAuth,
  requireSubredditPermission,
  csrfProtection,
};
