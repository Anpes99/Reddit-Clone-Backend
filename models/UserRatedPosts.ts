import {
  DataTypes,
  Model,
  type CreationOptional,
  type InferAttributes,
  type InferCreationAttributes,
} from "sequelize";

import { sequelize } from "../utils/db";

class UserRatedPosts extends Model<
  InferAttributes<UserRatedPosts>,
  InferCreationAttributes<UserRatedPosts>
> {
  declare id: CreationOptional<number>;
  declare userId: number;
  declare postId: number;
  declare rating: number;
}

UserRatedPosts.init(
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
    postId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: "posts", key: "id" },
    },
    rating: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
  },
  {
    sequelize,
    underscored: true,
    timestamps: false,
    modelName: "UserRatedPosts",
    indexes: [
      {
        unique: true,
        fields: ["post_id", "user_id"],
      },
    ],
  },
);

// `export =` keeps `require("./UserRatedPosts")` returning the class for JS callers
export = UserRatedPosts;
