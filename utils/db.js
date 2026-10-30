const Sequelize = require("sequelize");
require("dotenv").config();

const sequelize = new Sequelize(
  process.env.NODE_ENV === "test"
    ? process.env.TEST_DATABASE_URI
    : process.env.DATABASE_URI,
  {
    dialectOptions: {
      ...(process.env.NODE_ENV === "production"
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

const connectToDatabase = async () => {
  try {
    await sequelize.authenticate();
    console.log("database connected");
  } catch (err) {
    console.log("connecting database failed");
    console.log(err);
    return process.exit(1);
  }

  return null;
};

module.exports = { connectToDatabase, sequelize };
