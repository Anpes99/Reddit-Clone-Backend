const { Model, DataTypes } = require("sequelize");

const { sequelize } = require("../utils/db");

class PasswordResetToken extends Model {}

PasswordResetToken.init(
  {
    userId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      unique: true,
    },
    tokenHash: {
      type: DataTypes.STRING(64),
      allowNull: false,
      unique: true,
    },
    expiresAt: {
      type: DataTypes.DATE,
      allowNull: false,
    },
  },
  {
    sequelize,
    underscored: true,
    timestamps: true,
    modelName: "password_reset_token",
  },
);

module.exports = PasswordResetToken;
