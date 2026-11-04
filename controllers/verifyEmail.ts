import { Router, type Request } from "express";
import { AppError } from "../errors/index.js";
import { EmailVerificationToken, User } from "../models/index.js";
import {
  hashEmailVerificationToken,
  sendVerificationEmail,
} from "../utils/email.js";
import { validate } from "../utils/middleware/middleware.js";
import {
  verifyEmailSchema,
  resendVerifyEmailEmailSchema,
  type ResendVerifyEmailBody,
  type VerifyEmailBody,
} from "../validators/verify-email-validator.js";

const verifyEmailRouter = Router();

verifyEmailRouter.post(
  "/",
  validate(verifyEmailSchema),
  async (
    req: Request<Record<string, string>, unknown, VerifyEmailBody>,
    res,
  ) => {
    const token = req.body.token;

    const hashedToken = hashEmailVerificationToken(token);

    const dbEmailVerificationToken = await EmailVerificationToken.findOne({
      where: {
        tokenHash: hashedToken,
      },
    });
    if (!dbEmailVerificationToken) {
      throw new AppError({
        status: 403,
        code: "INVALID_OR_EXPIRED_TOKEN",
        message: "Invalid or expired token",
        details: {},
      });
    }

    if (dbEmailVerificationToken.usedAt) {
      return res.status(200).json({ message: "email already verified" });
    }

    if (dbEmailVerificationToken.expiresAt <= new Date()) {
      await dbEmailVerificationToken.destroy();

      throw new AppError({
        status: 410,
        code: "EXPIRED_TOKEN",
        message: "expired token",
        details: {},
      });
    }

    const user = await User.findByPk(dbEmailVerificationToken.userId);
    if (!user) {
      await dbEmailVerificationToken.destroy();

      throw new AppError({
        status: 403,
        code: "INVALID_OR_EXPIRED_TOKEN",
        message: "Invalid or expired token",
        details: {},
      });
    }
    await user.update({ emailVerified: true });
    await dbEmailVerificationToken.update({
      usedAt: new Date(),
    });

    return res.status(200).json({ message: "Email verified" });
  },
);

verifyEmailRouter.post(
  "/resend",
  validate(resendVerifyEmailEmailSchema),
  async (
    req: Request<Record<string, string>, unknown, ResendVerifyEmailBody>,
    res,
  ) => {
    const username = req.body.username;

    const user = await User.findOne({ where: { username } });
    if (!user) {
      throw new AppError({
        status: 404,
        code: "USER_NOT_FOUND",
        message: "user not found",
        details: {},
      });
    }
    if (user.emailVerified) {
      return res.status(200).json({
        status: "EMAIL_ALREADY_VERIFIED",
        message: "Email is already verified.",
      });
    }

    await EmailVerificationToken.destroy({ where: { userId: user.id } });

    await sendVerificationEmail({ email: user.email, userId: user.id });

    return res.status(200).json({ message: "new verification email sent" });
  },
);

export = verifyEmailRouter;
