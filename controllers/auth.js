const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const authRouter = require("express").Router();
const { User, Subreddit, Post } = require("../models/index");
const { validate } = require("../utils/middleware/middleware");
const { loginSchema } = require("../validators/login.validator");
const { loginIpLimiter } = require("../utils/middleware/loginIpLimiter");
const { redisClient } = require("../utils/redis");

const WINDOW_SECONDS = 15 * 60;

authRouter.post(
  "/login",
  validate(loginSchema),
  loginIpLimiter,
  async (request, response) => {
    const { body } = request;

    try {
      const identifier = body.username.trim().toLowerCase();
      const failureKeyIpForUsername = `login:failed:ip:${request.ip}:${identifier}`;

      const ipLoginFailures = await redisClient.get(failureKeyIpForUsername);
      if (ipLoginFailures > 10) {
        return response.status(429).json({
          error: "Too many attempts. Please try again later",
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

        return response.status(401).json({
          error: "invalid username or password",
        });
      }
      await redisClient.del(failureKeyIpForUsername);

      const userForToken = {
        username: user.username,
        id: user.id,
      };

      const token = jwt.sign(userForToken, process.env.SECRET, {
        expiresIn: 15 * 60,
      });

      const refreshToken = jwt.sign(
        { ...userForToken, type: "refresh" },
        process.env.REFRESH_SECRET,
        {
          expiresIn: 60 * 60 * 24,
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
    } catch (error) {
      console.log("error2:", error);
      response.status(401).json(error);
    }
  },
);

authRouter.post("/refresh", async (req, res) => {
  const token = req.cookies?.refreshToken;

  if (!token) {
    return res.status(401).json({
      error: {
        message: "refresh token missing",
        name: "MissingRefreshTokenError",
      },
    });
  }

  try {
    const decodedToken = jwt.verify(token, process.env.REFRESH_SECRET, {
      algorithms: ["HS256"],
    });

    if (decodedToken.type !== "refresh") {
      return res.status(401).json({
        error: {
          message: "invalid refresh token",
          name: "InvalidRefreshTokenError",
        },
      });
    }

    const user = await User.findByPk(decodedToken.id);

    if (!user) {
      res.clearCookie("refreshToken", {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
      });

      return res.status(401).json({
        error: {
          message: "User not found",
          name: "InvalidRefreshTokenError",
        },
      });
    }

    const userForToken = {
      username: user.username,
      id: user.id,
    };

    const accessToken = jwt.sign(userForToken, process.env.SECRET, {
      expiresIn: 15 * 60,
    });

    return res.json({ accessToken, username: user.username });
  } catch {
    res.clearCookie("refreshToken", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
    });

    return res.status(401).json({
      error: {
        message: "Refresh token invalid or expired",
        name: "InvalidRefreshTokenError",
      },
    });
  }
});

authRouter.post("/logout", async (req, res) => {
  res.clearCookie("refreshToken", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/api/auth",
  });

  return res.sendStatus(204);
});

module.exports = authRouter;
