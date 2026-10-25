const { Model, DataTypes } = require("sequelize");

const { sequelize } = require("../utils/db");

class SubredditLeaderboardSubreddit extends Model {}

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
      references: { model: "subreddit_leaderboard", key: "id" },
      onDelete: "CASCADE",
    },
    rank: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
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

module.exports = SubredditLeaderboardSubreddit;
