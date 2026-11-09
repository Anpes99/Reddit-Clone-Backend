import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import { Router, type Request } from "express";
import { User, Subreddit, Post, EmailVerificationToken } from "../models/index";
import { validate } from "../utils/middleware/middleware";
import { loginSchema, type LoginBody } from "../validators/login.validator";
import { loginIpLimiter } from "../utils/middleware/requestRateLimiters";
import { redisClient } from "../utils/redis";
import { sendVerificationEmail } from "../utils/email";
import { randomUUID } from "node:crypto";
import { AppError } from "../errors";
import logger from "../utils/logger";

const authRouter = Router();

const WINDOW_SECONDS = 15 * 60;
const REFRESH_TOKEN_EXPIRES_IN = 60 * 60 * 24;

type UserForToken = {
  username: string;
  id: number;
};

type RefreshTokenPayload = UserForToken & {
  type: "refresh";
  refreshTokenId: string;
  absoluteExpiresAt: number;
};

authRouter.post(
  "/login",
  validate(loginSchema),
  loginIpLimiter,
  async (
    request: Request<Record<string, string>, unknown, LoginBody>,
    response,
  ) => {
    const { body } = request;

    const identifier = body.username.trim().toLowerCase();
    const failureKeyIpForUsername = `login:failed:ip:${request.ip}:${identifier}`;

    const ipLoginFailures = await redisClient.get(failureKeyIpForUsername);
    if (Number(ipLoginFailures) > 10) {
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
          attributes: ["name", "id", "iconUrl"],
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
        {
          model: Subreddit,
          as: "subredditsModerated",
          attributes: ["name", "iconUrl"],
          through: { attributes: ["role"] },
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
    const userForToken: UserForToken = {
      username: user.username,
      id: user.id,
    };

    const token = jwt.sign(userForToken, process.env.SECRET as string, {
      expiresIn: 15 * 60,
    });
    const refreshTokenId = randomUUID();

    await redisClient.set(`refresh:${refreshTokenId}`, user.id, {
      EX: REFRESH_TOKEN_EXPIRES_IN,
    });
    const refreshTokenPayload: RefreshTokenPayload = {
      ...userForToken,
      type: "refresh",
      refreshTokenId,
      absoluteExpiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000, // 30 days
    };
    const refreshToken = jwt.sign(
      refreshTokenPayload,
      process.env.REFRESH_SECRET as string,
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
      ratedPosts: user.ratedPosts!.map((post) => ({
        id: post.id,
        rating: post.UserRatedPosts.rating,
      })),
      avatarImageUrl: user.avatarImageUrl,
      moderatedSubreddits: (user.subredditsModerated ?? []).map(
        (subreddit) => ({
          name: subreddit.name,
          iconUrl: subreddit.iconUrl,
          role: subreddit.subredditModerators.role,
        }),
      ),
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
    const decodedToken = jwt.verify(
      token,
      process.env.REFRESH_SECRET as string,
      {
        algorithms: ["HS256"],
      },
    ) as RefreshTokenPayload;
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

    const userForToken: UserForToken = {
      username: user.username,
      id: user.id,
    };

    const accessToken = jwt.sign(userForToken, process.env.SECRET as string, {
      expiresIn: 15 * 60,
    });

    const refreshTokenId = randomUUID();
    await redisClient.del(`refresh:${decodedToken.refreshTokenId}`);
    await redisClient.set(`refresh:${refreshTokenId}`, user.id, {
      EX: REFRESH_TOKEN_EXPIRES_IN,
    });
    const refreshTokenPayload: RefreshTokenPayload = {
      ...userForToken,
      type: "refresh",
      refreshTokenId,
      absoluteExpiresAt: decodedToken.absoluteExpiresAt,
    };
    const refreshToken = jwt.sign(
      refreshTokenPayload,
      process.env.REFRESH_SECRET as string,
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

  let decodedToken: RefreshTokenPayload | undefined;
  if (token) {
    try {
      decodedToken = jwt.verify(token, process.env.REFRESH_SECRET as string, {
        algorithms: ["HS256"],
      }) as RefreshTokenPayload;
    } catch {
      // ignore eslint rule
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

export = authRouter;
