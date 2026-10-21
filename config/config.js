require("dotenv").config();

module.exports = {
  production: {
    use_env_variable: "DATABASE_URI",
    dialect: "postgres",
    dialectOptions: {
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
};
