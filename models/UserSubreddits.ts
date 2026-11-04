import {
  DataTypes,
  Model,
  type CreationOptional,
  type InferAttributes,
  type InferCreationAttributes,
} from "sequelize";

import { sequelize } from "../utils/db";

class UserSubreddits extends Model<
  InferAttributes<UserSubreddits>,
  InferCreationAttributes<UserSubreddits>
> {
  declare id: CreationOptional<number>;
  declare userId: number;
  declare subredditId: number;
}

UserSubreddits.init(
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
    subredditId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: "subreddits", key: "id" },
    },
  },
  {
    sequelize,
    underscored: true,
    timestamps: false,
    modelName: "userSubreddits",
    indexes: [
      {
        unique: true,
        fields: ["subreddit_id", "user_id"],
      },
    ],
  },
);

// `export =` keeps `require("./UserSubreddits")` returning the class for JS callers
export = UserSubreddits;
