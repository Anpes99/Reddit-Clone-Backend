const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const authRouter = require("express").Router();
const {
  User,
  Subreddit,
  Post,
  EmailVerificationToken,
} = require("../models/index");
const { validate } = require("../utils/middleware/middleware");
const { loginSchema } = require("../validators/login.validator");
const { loginIpLimiter } = require("../utils/middleware/requestRateLimiters");
const { redisClient } = require("../utils/redis");
const { sendVerificationEmail } = require("../utils/email");
const { randomUUID } = require("node:crypto");
const { AppError } = require("../errors");
const logger = require("../utils/logger");

const WINDOW_SECONDS = 15 * 60;
const REFRESH_TOKEN_EXPIRES_IN = 60 * 60 * 24;

authRouter.post(
  "/login",
  validate(loginSchema),
  loginIpLimiter,
  async (request, response) => {
    const { body } = request;

    const identifier = body.username.trim().toLowerCase();
    const failureKeyIpForUsername = `login:failed:ip:${request.ip}:${identifier}`;

    const ipLoginFailures = await redisClient.get(failureKeyIpForUsername);
    if (ipLoginFailures > 10) {
      throw new AppError({
        status: 429,
        code: "TOO_MANY_REQUESTS",
        message: "Too many attempts. Please try again later",
        details: {},
      });
    }

    const user = await User.findOne({
      where: { username: body.username },
      include: [
        {
          model: Subreddit,
          attributes: ["name", "id"],
          as: "subreddits",
          required: false,
        },
        {
          model: Post,
          as: "ratedPosts",
          attributes: ["id"],
          through: {
            attributes: ["rating"],
          },
          required: false,
        },
      ],
    });

    const passwordCorrect =
      user === null
        ? false
        : await bcrypt.compare(body.password, user.passwordHash);

    if (!(user && passwordCorrect)) {
      const ipFailures = await redisClient.incr(failureKeyIpForUsername);

      if (ipFailures === 1) {
        await redisClient.expire(failureKeyIpForUsername, WINDOW_SECONDS);
      }

      throw new AppError({
        status: 401,
        code: "INVALID_USERNAME_OR_PASSWORD",
        message: "invalid username or password",
        details: {},
      });
    }
    await redisClient.del(failureKeyIpForUsername);
    if (!user.emailVerified) {
      await EmailVerificationToken.destroy({ where: { userId: user.id } });

      await sendVerificationEmail({
        email: user.email,
        userId: user.id,
      });

      throw new AppError({
        status: 403,
        code: "EMAIL_NOT_VERIFIED",
        message: "email not verified",
        details: { email: user.email },
      });
    }
    const userForToken = {
      username: user.username,
      id: user.id,
    };

    const token = jwt.sign(userForToken, process.env.SECRET, {
      expiresIn: 15 * 60,
    });
    const refreshTokenId = randomUUID();

    await redisClient.set(`refresh:${refreshTokenId}`, user.id, {
      EX: REFRESH_TOKEN_EXPIRES_IN,
    });
    const refreshToken = jwt.sign(
      {
        ...userForToken,
        type: "refresh",
        refreshTokenId,
        absoluteExpiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000, // 30 days
      },
      process.env.REFRESH_SECRET,
      {
        expiresIn: REFRESH_TOKEN_EXPIRES_IN,
      },
    );

    response.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/api/auth",
    });

    response.status(200).send({
      token,
      username: user.username,
      id: user.id,
      subreddits: user.subreddits,
      ratedPosts: user.ratedPosts.map((post) => ({
        id: post.id,
        rating: post.UserRatedPosts.rating,
      })),
      avatarImageUrl: user.avatarImageUrl,
    });
  },
);

authRouter.post("/refresh", async (req, res, next) => {
  const token = req.cookies?.refreshToken;

  if (!token) {
    throw new AppError({
      status: 401,
      code: "MISSING_REFRESH_TOKEN",
      message: "refresh token missing",
      details: {},
    });
  }

  try {
    const decodedToken = jwt.verify(token, process.env.REFRESH_SECRET, {
      algorithms: ["HS256"],
    });
    if (!decodedToken || decodedToken.absoluteExpiresAt <= Date.now()) {
      throw new Error("Invalid or expired refresh token");
    }

    if (decodedToken.type !== "refresh") {
      throw new AppError({
        status: 401,
        code: "INVALID_REFRESH_TOKEN_ERROR",
        message: "invalid refresh token",
        details: {},
      });
    }
    const redisTokenUserId = Number(
      await redisClient.get(`refresh:${decodedToken.refreshTokenId}`),
    );
    if (!redisTokenUserId || redisTokenUserId !== decodedToken.id) {
      res.clearCookie("refreshToken", {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/api/auth",
      });
      throw new Error("Refresh token revoked or invalid");
    }
    const user = await User.findByPk(decodedToken.id);

    if (!user) {
      res.clearCookie("refreshToken", {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/api/auth",
      });
      await redisClient.del(`refresh:${decodedToken.refreshTokenId}`);

      throw new AppError({
        status: 401,
        code: "INVALID_REFRESH_TOKEN_ERROR",
        message: "User not found",
        details: {},
      });
    }

    const userForToken = {
      username: user.username,
      id: user.id,
    };

    const accessToken = jwt.sign(userForToken, process.env.SECRET, {
      expiresIn: 15 * 60,
    });

    const refreshTokenId = randomUUID();
    await redisClient.del(`refresh:${decodedToken.refreshTokenId}`);
    await redisClient.set(`refresh:${refreshTokenId}`, user.id, {
      EX: REFRESH_TOKEN_EXPIRES_IN,
    });
    const refreshToken = jwt.sign(
      {
        ...userForToken,
        type: "refresh",
        refreshTokenId,
        absoluteExpiresAt: decodedToken.absoluteExpiresAt,
      },
      process.env.REFRESH_SECRET,
      {
        expiresIn: Math.min(
          REFRESH_TOKEN_EXPIRES_IN,
          Math.floor((decodedToken.absoluteExpiresAt - Date.now()) / 1000),
        ),
      },
    );

    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/api/auth",
    });

    return res.json({ accessToken, username: user.username });
  } catch (e) {
    res.clearCookie("refreshToken", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/api/auth",
    });

    return next(
      new AppError({
        status: 401,
        code: "INVALID_REFRESH_TOKEN_ERROR",
        message: "Refresh token invalid or expired",
        details: {},
      }),
    );
  }
});

authRouter.post("/logout", async (req, res) => {
  const token = req.cookies?.refreshToken;

  let decodedToken;
  if (token) {
    try {
      decodedToken = jwt.verify(token, process.env.REFRESH_SECRET, {
        algorithms: ["HS256"],
      });
    } catch {
      // eslint-disable-next-line no-empty
    }
  }

  if (decodedToken) {
    try {
      await redisClient.del(`refresh:${decodedToken.refreshTokenId}`);
    } catch (error) {
      logger.error({ err: error }, "Failed to revoke refresh token:");
    }
  }

  res.clearCookie("refreshToken", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/api/auth",
  });

  return res.sendStatus(204);
});

module.exports = authRouter;
