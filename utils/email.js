require("dotenv").config();

const nodemailer = require("nodemailer");
const { EmailVerificationToken, PasswordResetToken } = require("../models");
const crypto = require("node:crypto");

const transporter = nodemailer.createTransport({
  host: process.env.BREVO_SMTP_HOST,
  port: Number(process.env.BREVO_SMTP_PORT || 587),
  secure: false,
  auth: {
    user: process.env.BREVO_SMTP_USER,
    pass: process.env.BREVO_SMTP_KEY,
  },
});

const sendEmail = async ({ to, subject, text, html }) => {
  return transporter.sendMail({
    from: `"Reddit clone app" <${process.env.MAIL_FROM}>`,
    to,
    subject,
    text,
    html,
  });
};

const getSendVerificationEmailHTML = ({ verificationUrl }) => `
  <div style="
    margin: 0;
    padding: 40px 20px;
    background-color: #f4f7fb;
    font-family: Arial, Helvetica, sans-serif;
  ">
    <div style="
      max-width: 480px;
      margin: 0 auto;
      padding: 40px 32px;
      background-color: #ffffff;
      border-radius: 16px;
      text-align: center;
      border: 1px solid #e8edf3;
    ">
      <div style="
        width: 64px;
        height: 64px;
        margin: 0 auto 24px;
        background-color: #e8f2ff;
        border-radius: 50%;
        line-height: 64px;
        font-size: 30px;
      ">
        ✉️
      </div>

      <h2 style="
        margin: 0 0 16px;
        color: #172033;
        font-size: 28px;
        font-weight: 700;
        letter-spacing: -0.5px;
      ">
        Verify your email
      </h2>

      <p style="
        margin: 0 0 28px;
        color: #64748b;
        font-size: 16px;
        line-height: 1.7;
      ">
        Welcome to Test Programming Project!
        Please verify your email address to activate
        your account and get started.
      </p>

      <a
        href="${verificationUrl}"
        style="
          display: inline-block;
          padding: 15px 32px;
          background-color: #2563eb;
          color: #ffffff;
          text-decoration: none;
          font-size: 16px;
          font-weight: 600;
          border-radius: 10px;
        "
      >
        Verify email &rarr;
      </a>

      <p style="
        margin: 28px 0 8px;
        color: #94a3b8;
        font-size: 13px;
        line-height: 1.6;
      ">
        If you didn't create an account with
        Test Programming Project, you can safely
        ignore this email.
      </p>

      <div style="
        margin-top: 28px;
        padding-top: 20px;
        border-top: 1px solid #eef2f7;
        color: #94a3b8;
        font-size: 12px;
        line-height: 1.6;
      ">
        &copy; ${new Date().getFullYear()}
        Test Programming Project.
        All rights reserved.
      </div>
    </div>
  </div>
`;

const EMAIL_VERIFY_TOKEN_EXPIRES_AFTER_MS = 30 * 60 * 1000; // 30 minutes

const hashEmailVerificationToken = (token) =>
  crypto.createHash("sha256").update(token).digest("hex");

const sendVerificationEmail = async ({ email, userId }) => {
  if (!email || !userId) {
    throw new Error("email or userId missing");
  }
  const unHashedEmailVerificationToken = crypto.randomBytes(32).toString("hex");

  const emailVerificationTokenHash = hashEmailVerificationToken(
    unHashedEmailVerificationToken,
  );

  const emailVerificationTokenExpiresAt = new Date(
    Date.now() + EMAIL_VERIFY_TOKEN_EXPIRES_AFTER_MS,
  );

  await EmailVerificationToken.create({
    userId,
    tokenHash: emailVerificationTokenHash,
    expiresAt: emailVerificationTokenExpiresAt,
  });

  const verificationUrl = `${process.env.CLIENT_URL}/verify-email?token=${unHashedEmailVerificationToken}`;

  await sendEmail({
    to: email,
    subject: "Verify your email address",
    text: `Verify your email by visiting: ${verificationUrl}`,
    html: getSendVerificationEmailHTML({ verificationUrl }),
  });
};

const getSendPasswordResetEmailHTML = ({ resetUrl }) => `
  <div style="
    margin: 0;
    padding: 40px 20px;
    background-color: #f4f7fb;
    font-family: Arial, Helvetica, sans-serif;
  ">
    <div style="
      max-width: 480px;
      margin: 0 auto;
      padding: 40px 32px;
      background-color: #ffffff;
      border-radius: 16px;
      text-align: center;
      border: 1px solid #e8edf3;
    ">
      <div style="
        width: 64px;
        height: 64px;
        margin: 0 auto 24px;
        background-color: #e8f2ff;
        border-radius: 50%;
        line-height: 64px;
        font-size: 30px;
      ">
        🔐
      </div>

      <h2 style="
        margin: 0 0 16px;
        color: #172033;
        font-size: 28px;
        font-weight: 700;
      ">
        Reset your password
      </h2>

      <p style="
        margin: 0 0 28px;
        color: #64748b;
        font-size: 16px;
        line-height: 1.7;
      ">
        We received a request to reset your password.
        Click the button below to choose a new password.
      </p>

      <a
        href="${resetUrl}"
        style="
          display: inline-block;
          padding: 15px 32px;
          background-color: #2563eb;
          color: #ffffff;
          text-decoration: none;
          font-size: 16px;
          font-weight: 600;
          border-radius: 10px;
        "
      >
        Reset password &rarr;
      </a>

      <p style="
        margin: 28px 0 8px;
        color: #94a3b8;
        font-size: 13px;
        line-height: 1.6;
      ">
        This link expires in 30 minutes.
        If you didn't request a password reset,
        you can safely ignore this email.
      </p>

      <div style="
        margin-top: 28px;
        padding-top: 20px;
        border-top: 1px solid #eef2f7;
        color: #94a3b8;
        font-size: 12px;
      ">
        &copy; ${new Date().getFullYear()}
        Test Programming Project.
        All rights reserved.
      </div>
    </div>
  </div>
`;

const PASSWORD_RESET_TOKEN_EXPIRES_AFTER_MS = 30 * 60 * 1000; // 30 minutes

const hashPasswordResetToken = (token) =>
  crypto.createHash("sha256").update(token).digest("hex");

const sendPasswordResetEmail = async ({ email, userId }) => {
  if (!email || !userId) {
    throw new Error("email or userId missing");
  }

  const unHashedPasswordResetToken = crypto.randomBytes(32).toString("hex");

  const passwordResetTokenHash = hashPasswordResetToken(
    unHashedPasswordResetToken,
  );

  const passwordResetTokenExpiresAt = new Date(
    Date.now() + PASSWORD_RESET_TOKEN_EXPIRES_AFTER_MS,
  );

  await PasswordResetToken.destroy({
    where: { userId },
  });

  await PasswordResetToken.create({
    userId,
    tokenHash: passwordResetTokenHash,
    expiresAt: passwordResetTokenExpiresAt,
  });

  const resetUrl =
    `${process.env.CLIENT_URL}/reset-password` +
    `?token=${encodeURIComponent(unHashedPasswordResetToken)}`;

  await sendEmail({
    to: email,
    subject: "Reset your password",
    text: `Reset your password by visiting: ${resetUrl}`,
    html: getSendPasswordResetEmailHTML({ resetUrl }),
  });
};

module.exports = {
  sendEmail,
  sendVerificationEmail,
  hashEmailVerificationToken,
  hashPasswordResetToken,
  sendPasswordResetEmail,
};
