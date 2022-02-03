require("dotenv").config();

const DATABASE_URI =
  process.env.NODE_ENV === "test"
    ? process.env.TEST_DATABASE_URI
    : process.env.DATABASE_URI;

const PORT = process.env.PORT;

const NODE_ENV = process.env.NODE_ENV;

module.exports = { DATABASE_URI, PORT, NODE_ENV };
