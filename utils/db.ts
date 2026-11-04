import { Sequelize } from "sequelize";
import logger from "./logger";
import "dotenv/config";

export const sequelize = new Sequelize(
  (process.env.NODE_ENV === "test"
    ? process.env.TEST_DATABASE_URI
    : process.env.DATABASE_URI) as string,
  {
    logging: (sql) => logger.debug(sql),
    dialectOptions: {
      // Set DATABASE_SSL=false for a local production run (e.g. Docker).
      ...(process.env.NODE_ENV === "production" &&
      process.env.DATABASE_SSL !== "false"
        ? {
            ssl: {
              require: true,
              rejectUnauthorized: false,
            },
          }
        : {
            ssl: false,
          }),
    },
  },
);

export const connectToDatabase = async () => {
  try {
    await sequelize.authenticate();
    logger.info("database connected");
  } catch (err) {
    logger.error({ err }, "connecting database failed");

    return process.exit(1);
  }

  return null;
};
