const { Model, DataTypes } = require("sequelize");

const { sequelize } = require("../utils/db");

class UserRatedPosts extends Model {}

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
  }
);

module.exports = UserRatedPosts;
