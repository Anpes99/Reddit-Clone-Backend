const EmailVerificationToken = require("../models/EmailVerificationToken.js");
const User = require("../models/User.js");
const {
  hashEmailVerificationToken,
  sendVerificationEmail,
} = require("../utils/email.js");
const { validate } = require("../utils/middleware/middleware.js");
const {
  verifyEmailSchema,
  resendVerifyEmailEmailSchema,
} = require("../validators/verify-email-validator.js");
const verifyEmailRouter = require("express").Router();

verifyEmailRouter.post("/", validate(verifyEmailSchema), async (req, res) => {
  const token = req.body.token;

  const hashedToken = hashEmailVerificationToken(token);

  const dbEmailVerificationToken = await EmailVerificationToken.findOne({
    where: {
      tokenHash: hashedToken,
    },
  });
  if (!dbEmailVerificationToken) {
    return res.status(403).json({
      message: "Invalid or expired token",
    });
  }

  if (dbEmailVerificationToken.usedAt) {
    return res.status(200).json({ message: "email already verified" });
  }

  if (dbEmailVerificationToken.expiresAt <= new Date()) {
    await dbEmailVerificationToken.destroy();

    return res.status(410).json({
      message: "Invalid or expired token",
    });
  }

  const user = await User.findByPk(dbEmailVerificationToken.userId);
  if (!user) {
    await dbEmailVerificationToken.destroy();
    return res.status(403).json({
      message: "Invalid or expired token",
    });
  }
  await user.update({ emailVerified: true });
  await dbEmailVerificationToken.update({
    usedAt: new Date(),
  });

  return res.status(200).json({ message: "Email verified" });
});

verifyEmailRouter.post(
  "/resend",
  validate(resendVerifyEmailEmailSchema),
  async (req, res) => {
    const username = req.body.username;

    const user = await User.findOne({ where: { username } });
    if (!user) {
      return res.status(400).json({ message: "user not found" });
    }
    if (user.emailVerified) {
      return res.status(200).json({
        status: "EMAIL_ALREADY_VERIFIED",
        message: "Email is already verified.",
      });
    }

    const dbEmailVerificationToken = await EmailVerificationToken.findOne({
      where: {
        userId: user.id,
      },
    });
    await dbEmailVerificationToken.destroy();

    await sendVerificationEmail({ email: user.email, userId: user.id });

    return res.status(200).json({ message: "new verification email sent" });
  },
);

module.exports = verifyEmailRouter;
