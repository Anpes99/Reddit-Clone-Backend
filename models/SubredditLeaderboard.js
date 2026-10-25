const { Model, DataTypes } = require("sequelize");

const { sequelize } = require("../utils/db");

class SubredditLeaderboard extends Model {}

SubredditLeaderboard.init(
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    date: {
      type: DataTypes.DATEONLY,
      allowNull: false,
      unique: true,
    },
  },
  {
    sequelize,
    underscored: true,
    timestamps: true,
    modelName: "subreddit_leaderboard",
  },
);

module.exports = SubredditLeaderboard;
