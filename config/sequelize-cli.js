require("dotenv").config();

module.exports = {
  production: {
    use_env_variable: "DATABASE_URI",
    dialect: "postgres",
    dialectOptions:
      process.env.DATABASE_SSL === "false"
        ? {}
        : {
            ssl: {
              require: true,
              rejectUnauthorized: false,
            },
          },
  },
  development: {
    use_env_variable: "DATABASE_URI",
    dialect: "postgres",
  },
  test: {
    use_env_variable: "TEST_DATABASE_URI",
    dialect: "postgres",
  },
};
