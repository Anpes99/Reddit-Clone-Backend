const { Model, DataTypes } = require("sequelize");

const { sequelize } = require("../utils/db");

class UserSubreddits extends Model {}

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
  }
);

module.exports = UserSubreddits;
