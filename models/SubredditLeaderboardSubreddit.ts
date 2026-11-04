import {
  DataTypes,
  Model,
  type CreationOptional,
  type InferAttributes,
  type InferCreationAttributes,
} from "sequelize";

import { sequelize } from "../utils/db";

class SubredditLeaderboardSubreddit extends Model<
  InferAttributes<SubredditLeaderboardSubreddit>,
  InferCreationAttributes<SubredditLeaderboardSubreddit>
> {
  declare id: CreationOptional<number>;
  declare subredditId: number;
  declare subredditLeaderboardId: number;
  declare rank: number;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
}

SubredditLeaderboardSubreddit.init(
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    subredditId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: "subreddits", key: "id" },
    },
    subredditLeaderboardId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: "subreddit_leaderboards", key: "id" },
      onDelete: "CASCADE",
    },
    rank: {
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
    modelName: "subreddit_leaderboard_subreddit",
    indexes: [
      {
        unique: true,
        fields: ["subreddit_leaderboard_id", "rank"],
      },
      {
        unique: true,
        fields: ["subreddit_leaderboard_id", "subreddit_id"],
      },
    ],
  },
);

// `export =` keeps `require("./SubredditLeaderboardSubreddit")` returning the class for JS callers
export = SubredditLeaderboardSubreddit;
