import "dotenv/config";

export const DATABASE_URI =
  process.env.NODE_ENV === "test"
    ? process.env.TEST_DATABASE_URI
    : process.env.DATABASE_URI;

export const PORT = process.env.PORT;

export const NODE_ENV = process.env.NODE_ENV;
