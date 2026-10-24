const { Model, DataTypes } = require("sequelize");

const { sequelize } = require("../utils/db");
require("pgvector/sequelize");
class Post extends Model {}

Post.init(
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
      field: "subreddit_id",
      allowNull: false,
      references: { model: "subreddits", key: "id" },
    },
    upVotes: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    downVotes: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    title: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    text: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    imageUrl: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    commentCount: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    embedding: {
      type: DataTypes.VECTOR(512),
      allowNull: false,
    },
  },
  {
    sequelize,
    underscored: true,
    timestamps: true,
    modelName: "post",
  },
);

module.exports = Post;
