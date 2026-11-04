import {
  DataTypes,
  Model,
  type CreationOptional,
  type InferAttributes,
  type InferCreationAttributes,
} from "sequelize";

import { sequelize } from "../utils/db";

class UserRatedComments extends Model<
  InferAttributes<UserRatedComments>,
  InferCreationAttributes<UserRatedComments>
> {
  declare id: CreationOptional<number>;
  declare userId: number;
  declare commentId: number;
  declare rating: number;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
}

UserRatedComments.init(
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
    },
    commentId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: "comments", key: "id" },
    },
    rating: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    createdAt: DataTypes.DATE,
    updatedAt: DataTypes.DATE,
  },
  {
    sequelize,
    underscored: true,
    timestamps: true,
    modelName: "userRatedComments",
    indexes: [
      {
        unique: true,
        fields: ["comment_id", "user_id"],
      },
    ],
  },
);

// `export =` keeps `require("./UserRatedComments")` returning the class for JS callers
export = UserRatedComments;
