const { Model, DataTypes } = require("sequelize");

const { sequelize } = require("../utils/db");
const { SubredditModeratorRole } = require("../enums/subreddit.enum");

class SubredditModerators extends Model {}

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
      type: DataTypes.ENUM(Object.values(SubredditModeratorRole)),
      allowNull: false,
    },
  },
  {
    sequelize,
    underscored: true,
    timestamps: true,
    modelName: "subredditModerators",
    indexes: [
      {
        unique: true,
        fields: ["subredditId", "userId"],
      },
    ],
  },
);

module.exports = SubredditModerators;
