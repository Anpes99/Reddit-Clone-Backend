import {
  DataTypes,
  Model,
  type CreationOptional,
  type InferAttributes,
  type InferCreationAttributes,
} from "sequelize";

import { sequelize } from "../utils/db";
import {
  SUBREDDIT_MODERATOR_ROLE,
  type SubredditModeratorRole,
} from "../constants/subreddit.constant";

class SubredditModerators extends Model<
  InferAttributes<SubredditModerators>,
  InferCreationAttributes<SubredditModerators>
> {
  declare id: CreationOptional<number>;
  declare userId: number;
  declare subredditId: number;
  declare role: SubredditModeratorRole;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
}

SubredditModerators.init(
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
    role: {
      type: DataTypes.ENUM(...Object.values(SUBREDDIT_MODERATOR_ROLE)),
      allowNull: false,
    },
    createdAt: DataTypes.DATE,
    updatedAt: DataTypes.DATE,
  },
  {
    sequelize,
    underscored: true,
    timestamps: true,
    modelName: "subredditModerators",
    indexes: [
      {
        unique: true,
        fields: ["subreddit_id", "user_id"],
      },
    ],
  },
);

// `export =` keeps `require("./SubredditModerators")` returning the class for JS callers
export = SubredditModerators;
