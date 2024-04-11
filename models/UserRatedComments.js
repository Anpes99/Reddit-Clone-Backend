const { Model, DataTypes } = require("sequelize");

const { sequelize } = require("../utils/db");

class UserRatedComments extends Model {}

UserRatedComments.init(
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
    commentId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: "comments", key: "id" },
    },
    rating: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
  },
  {
    sequelize,
    underscored: true,
    timestamps: true,
    modelName: "userRatedComments",
  }
);

module.exports = UserRatedComments;
