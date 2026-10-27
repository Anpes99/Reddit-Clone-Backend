const { Model, DataTypes } = require("sequelize");

const { sequelize } = require("../utils/db");

class EmailVerificationToken extends Model {}

EmailVerificationToken.init(
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    userId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: "users", key: "id" },
      unique: true,
      onDelete: "CASCADE",
    },
    tokenHash: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
    expiresAt: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    usedAt: {
      type: DataTypes.DATE,
    },
  },
  {
    sequelize,
    underscored: true,
    timestamps: true,
    modelName: "email_verification_token",
  },
);

module.exports = EmailVerificationToken;
