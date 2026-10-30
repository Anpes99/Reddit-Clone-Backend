const crypto = require("node:crypto");

jest.mock("nodemailer", () => ({
  createTransport: jest.fn(() => ({
    sendMail: jest.fn().mockResolvedValue({
      messageId: "test-message-id",
    }),
  })),
}));

jest.mock("../models", () => ({
  EmailVerificationToken: {
    create: jest.fn(),
  },
  PasswordResetToken: {
    create: jest.fn(),
    destroy: jest.fn(),
  },
}));

const nodemailer = require("nodemailer");
const { EmailVerificationToken } = require("../models");
const { sendVerificationEmail } = require("../utils/email");

const transporter = nodemailer.createTransport.mock.results[0].value;

describe("sendVerificationEmail", () => {
  const originalClientUrl = process.env.CLIENT_URL;

  beforeEach(() => {
    jest.clearAllMocks();

    process.env.CLIENT_URL = "https://example.test";

    EmailVerificationToken.create.mockResolvedValue({ id: 1 });
    transporter.sendMail.mockResolvedValue({
      messageId: "test-message-id",
    });
  });

  afterAll(() => {
    if (originalClientUrl === undefined) {
      delete process.env.CLIENT_URL;
    } else {
      process.env.CLIENT_URL = originalClientUrl;
    }
  });

  it("stores a hashed expiring token and emails the matching verification link", async () => {
    const startedAt = Date.now();

    await sendVerificationEmail({
      email: "person@example.test",
      userId: 12,
    });

    expect(EmailVerificationToken.create).toHaveBeenCalledTimes(1);

    const [{ userId, tokenHash, expiresAt }] =
      EmailVerificationToken.create.mock.calls[0];

    expect(userId).toBe(12);
    expect(tokenHash).toMatch(/^[a-f0-9]{64}$/);
    expect(expiresAt).toBeInstanceOf(Date);

    const expectedExpiry = startedAt + 30 * 60 * 1000;

    expect(expiresAt.getTime()).toBeGreaterThanOrEqual(expectedExpiry);
    expect(expiresAt.getTime()).toBeLessThan(expectedExpiry + 1000);

    expect(transporter.sendMail).toHaveBeenCalledTimes(1);

    const [message] = transporter.sendMail.mock.calls[0];

    expect(message.to).toBe("person@example.test");
    expect(message.subject).toBe("Verify your email address");

    const match = message.text.match(/https:\/\/\S+/);
    expect(match).not.toBeNull();

    const verificationUrl = match[0].replace(/[),.]+$/, "");
    const url = new URL(verificationUrl);
    const rawToken = url.searchParams.get("token");

    expect(url.origin).toBe("https://example.test");
    expect(url.pathname).toBe("/verify-email");
    expect(rawToken).toMatch(/^[a-f0-9]{64}$/);

    expect(tokenHash).toBe(
      crypto.createHash("sha256").update(rawToken).digest("hex"),
    );

    expect(message.html).toContain(verificationUrl);
  });

  it.each([[{ userId: 12 }], [{ email: "person@example.test" }]])(
    "rejects missing recipient data: %o",
    async (input) => {
      await expect(sendVerificationEmail(input)).rejects.toThrow(
        "email or userId missing",
      );

      expect(EmailVerificationToken.create).not.toHaveBeenCalled();
      expect(transporter.sendMail).not.toHaveBeenCalled();
    },
  );

  it("does not send email when token persistence fails", async () => {
    EmailVerificationToken.create.mockRejectedValue(
      new Error("database unavailable"),
    );

    await expect(
      sendVerificationEmail({
        email: "person@example.test",
        userId: 12,
      }),
    ).rejects.toThrow("database unavailable");

    expect(EmailVerificationToken.create).toHaveBeenCalledTimes(1);
    expect(transporter.sendMail).not.toHaveBeenCalled();
  });

  it("propagates email delivery failures", async () => {
    transporter.sendMail.mockRejectedValue(
      new Error("email service unavailable"),
    );

    await expect(
      sendVerificationEmail({
        email: "person@example.test",
        userId: 12,
      }),
    ).rejects.toThrow("email service unavailable");

    expect(EmailVerificationToken.create).toHaveBeenCalledTimes(1);
    expect(transporter.sendMail).toHaveBeenCalledTimes(1);
  });
});
