const { Model, DataTypes } = require("sequelize");

const { sequelize } = require("../utils/db");
const { USER_NOTIFICATION_TYPES } = require("../enums/user.enum");

class UserNotifications extends Model {}

UserNotifications.init(
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
      onDelete: "CASCADE",
    },
    type: {
      type: DataTypes.ENUM(Object.values(USER_NOTIFICATION_TYPES)),
      allowNull: false,
    },
    title: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    message: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    isRead: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    deliveredAt: {
      type: DataTypes.DATE,
      defaultValue: null,
    },
  },
  {
    sequelize,
    underscored: true,
    timestamps: true,
    modelName: "user_notifications",
  },
);

module.exports = UserNotifications;
