import {
  DataTypes,
  Model,
  type CreationOptional,
  type InferAttributes,
  type InferCreationAttributes,
  type NonAttribute,
} from "sequelize";

import { sequelize } from "../utils/db";
import type Subreddit from "./Subreddit";
import {
  POST_MODERATION_STATUS,
  type PostModerationStatus,
} from "../constants/post.constant";
import "pgvector/sequelize";

class Post extends Model<InferAttributes<Post>, InferCreationAttributes<Post>> {
  declare id: CreationOptional<number>;
  declare userId: number;
  declare subredditId: number;
  declare upVotes: CreationOptional<number>;
  declare downVotes: CreationOptional<number>;
  declare title: string;
  declare text: string;
  declare imageUrl: CreationOptional<string | null>;
  declare commentCount: CreationOptional<number>;
  declare embedding: number[];
  declare safe: CreationOptional<boolean | null>;
  declare moderationStatus: CreationOptional<PostModerationStatus | null>;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;

  // Associations from models/index, only set when included in a query
  declare subreddit?: NonAttribute<Subreddit | null>;
}

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
    safe: {
      type: DataTypes.BOOLEAN,
    },
    moderationStatus: {
      type: DataTypes.ENUM(...Object.values(POST_MODERATION_STATUS)),
    },
    createdAt: DataTypes.DATE,
    updatedAt: DataTypes.DATE,
  },
  {
    sequelize,
    underscored: true,
    timestamps: true,
    modelName: "post",
  },
);

// `export =` keeps `require("./Post")` returning the class for JS callers
export = Post;
