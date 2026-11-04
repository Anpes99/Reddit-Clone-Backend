import {
  DataTypes,
  Model,
  type CreationOptional,
  type InferAttributes,
  type InferCreationAttributes,
} from "sequelize";

import { sequelize } from "../utils/db";

class SubredditLeaderboard extends Model<
  InferAttributes<SubredditLeaderboard>,
  InferCreationAttributes<SubredditLeaderboard>
> {
  declare id: CreationOptional<number>;
  // DATEONLY columns are read and written as "YYYY-MM-DD" strings
  declare date: string;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
}

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
    createdAt: DataTypes.DATE,
    updatedAt: DataTypes.DATE,
  },
  {
    sequelize,
    underscored: true,
    timestamps: true,
    modelName: "subreddit_leaderboard",
  },
);

// `export =` keeps `require("./SubredditLeaderboard")` returning the class for JS callers
export = SubredditLeaderboard;
