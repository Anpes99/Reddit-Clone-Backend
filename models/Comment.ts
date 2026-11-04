import {
  DataTypes,
  Model,
  type CreationOptional,
  type InferAttributes,
  type InferCreationAttributes,
  type NonAttribute,
} from "sequelize";

import { sequelize } from "../utils/db";
import type Post from "./Post";

class Comment extends Model<
  InferAttributes<Comment>,
  InferCreationAttributes<Comment>
> {
  declare id: CreationOptional<number>;
  declare postId: number;
  declare userId: number | null;
  declare commentId: CreationOptional<number | null>;
  declare upVotes: CreationOptional<number>;
  declare downVotes: CreationOptional<number>;
  declare directReplyToPost: boolean;
  declare text: string;
  declare descendantCount: CreationOptional<number>;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;

  // Associations from models/index, only set when included in a query
  declare post?: NonAttribute<Post>;
  declare parentComment?: NonAttribute<Comment | null>;
}

Comment.init(
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    postId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: "posts", key: "id" },
      onDelete: "CASCADE",
    },
    userId: {
      type: DataTypes.INTEGER,
      references: { model: "users", key: "id" },
      onDelete: "SET NULL",
    },
    commentId: {
      type: DataTypes.INTEGER,
      references: { model: "comments", key: "id" },
      onDelete: "RESTRICT",
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
    directReplyToPost: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
    },
    text: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    descendantCount: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    createdAt: DataTypes.DATE,
    updatedAt: DataTypes.DATE,
  },
  {
    sequelize,
    underscored: true,
    timestamps: true,
    modelName: "comment",
  },
);

// `export =` keeps `require("./Comment")` returning the class for JS callers
export = Comment;
