import {
  DataTypes,
  Model,
  type CreationOptional,
  type InferAttributes,
  type InferCreationAttributes,
  type NonAttribute,
} from "sequelize";

import { sequelize } from "../utils/db";
import type SubredditModerators from "./SubredditModerators";
import type User from "./User";

class Subreddit extends Model<
  InferAttributes<Subreddit>,
  InferCreationAttributes<Subreddit>
> {
  declare id: CreationOptional<number>;
  declare name: string;
  declare description: string;
  declare creatorId: number;
  declare iconUrl: CreationOptional<string | null>;
  declare subredditPageBackgroundImageUrl: CreationOptional<string | null>;
  declare memberCount: CreationOptional<number>;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;

  // Association from models/index, only set when included in a query
  declare moderators?: NonAttribute<
    (User & { subredditModerators: SubredditModerators })[]
  >;
}

Subreddit.init(
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    name: {
      type: DataTypes.CITEXT,
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
      onDelete: "RESTRICT",
    },
    iconUrl: {
      type: DataTypes.STRING,
    },
    subredditPageBackgroundImageUrl: {
      type: DataTypes.TEXT,
    },
    memberCount: {
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
    modelName: "subreddit",
  },
);

// `export =` keeps `require("./Subreddit")` returning the class for JS callers
export = Subreddit;
