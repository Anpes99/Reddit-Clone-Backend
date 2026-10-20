const { Model, DataTypes } = require("sequelize");

const { sequelize } = require("../utils/db");

class Subreddit extends Model {}

Subreddit.init(
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    creatorId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: "users", key: "id" },
    },
    iconUrl: {
      type: DataTypes.STRING,
    },
    subredditPageBackgroundImageUrl: {
      type: DataTypes.TEXT,
    },
  },
  {
    sequelize,
    underscored: true,
    timestamps: true,
    modelName: "subreddit",
  },
);

module.exports = Subreddit;
