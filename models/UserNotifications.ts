import {
  DataTypes,
  Model,
  type CreationOptional,
  type InferAttributes,
  type InferCreationAttributes,
} from "sequelize";

import { sequelize } from "../utils/db";
import { USER_NOTIFICATION_TYPES } from "../enums/user.enum";

type UserNotificationType =
  (typeof USER_NOTIFICATION_TYPES)[keyof typeof USER_NOTIFICATION_TYPES];

class UserNotifications extends Model<
  InferAttributes<UserNotifications>,
  InferCreationAttributes<UserNotifications>
> {
  declare id: CreationOptional<number>;
  declare userId: number;
  declare type: UserNotificationType;
  declare title: string;
  declare message: string;
  declare isRead: CreationOptional<boolean | null>;
  declare deliveredAt: CreationOptional<Date | null>;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
}

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
      type: DataTypes.ENUM(...Object.values(USER_NOTIFICATION_TYPES)),
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
    createdAt: DataTypes.DATE,
    updatedAt: DataTypes.DATE,
  },
  {
    sequelize,
    underscored: true,
    timestamps: true,
    modelName: "user_notifications",
  },
);

// `export =` keeps `require("./UserNotifications")` returning the class for JS callers
export = UserNotifications;
