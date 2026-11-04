import {
  DataTypes,
  Model,
  type CreationOptional,
  type InferAttributes,
  type InferCreationAttributes,
} from "sequelize";

import { sequelize } from "../utils/db";

class User extends Model<InferAttributes<User>, InferCreationAttributes<User>> {
  declare id: CreationOptional<number>;
  declare username: string;
  declare email: string | null;
  declare emailVerified: CreationOptional<boolean>;
  declare introduction: CreationOptional<string | null>;
  declare passwordHash: string;
  declare avatarImageUrl: CreationOptional<string | null>;
  declare profilePageBackgroundImageUrl: CreationOptional<string | null>;
  declare karma: CreationOptional<number>;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
}

User.init(
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    username: {
      type: DataTypes.CITEXT,
      unique: true,
      allowNull: false,
    },
    email: {
      type: DataTypes.STRING,
      unique: true,
    },
    emailVerified: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    introduction: {
      type: DataTypes.TEXT,
    },
    passwordHash: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    avatarImageUrl: {
      type: DataTypes.TEXT,
    },
    profilePageBackgroundImageUrl: {
      type: DataTypes.TEXT,
    },
    karma: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    createdAt: DataTypes.DATE,
    updatedAt: DataTypes.DATE,
  },
  {
    sequelize,
    underscored: true,
    timestamps: true,
    modelName: "user",
    indexes: [
      {
        name: "users_email_lower_key",
        unique: true,
        fields: [sequelize.fn("lower", sequelize.col("email"))],
      },
    ],
  },
);

// `export =` keeps `require("./User")` returning the class for JS callers
export = User;
