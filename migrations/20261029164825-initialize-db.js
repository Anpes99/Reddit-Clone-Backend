"use strict";

const fs = require("fs");
const path = require("path");

const BASELINE_TABLES = [
  "comments",
  "email_verification_tokens",
  "password_reset_tokens",
  "posts",
  "subreddit_leaderboard_subreddits",
  "subreddit_leaderboards",
  "subreddit_moderators",
  "subreddits",
  "user_rated_comments",
  "user_rated_posts",
  "user_subreddits",
  "users",
];

// Extensions whose objects the dump references as public.<name>. Each is
// rewritten to the schema the extension is actually installed in.
const EXTENSION_OBJECTS = {
  vector: ["vector", "vector_cosine_ops"],
  pg_trgm: ["gin_trgm_ops"],
};

module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.sequelize.query(
        "CREATE EXTENSION IF NOT EXISTS vector;",
        { transaction },
      );
      await queryInterface.sequelize.query(
        "CREATE EXTENSION IF NOT EXISTS pg_trgm;",
        { transaction },
      );

      const [tables] = await queryInterface.sequelize.query(
        `
          SELECT tablename
          FROM pg_catalog.pg_tables
          WHERE schemaname = 'public'
            AND tablename IN (:baselineTables);
        `,
        { replacements: { baselineTables: BASELINE_TABLES }, transaction },
      );

      if (tables.length === BASELINE_TABLES.length) {
        console.log(
          "Baseline skipped: database already has the baseline schema.",
        );
        return;
      }

      if (tables.length > 0) {
        const existingTables = tables.map(({ tablename }) => tablename);
        const missingTables = BASELINE_TABLES.filter(
          (table) => !existingTables.includes(table),
        );
        throw new Error(
          `Database is partially initialized. Missing baseline tables: ${missingTables.join(", ")}`,
        );
      }

      const [extensions] = await queryInterface.sequelize.query(
        `
          SELECT extension.extname AS name,
            quote_ident(namespace.nspname) AS schema
          FROM pg_catalog.pg_extension extension
          JOIN pg_catalog.pg_namespace namespace
            ON namespace.oid = extension.extnamespace
          WHERE extension.extname IN (:extensionNames);
        `,
        {
          replacements: { extensionNames: Object.keys(EXTENSION_OBJECTS) },
          transaction,
        },
      );

      let sql = fs.readFileSync(
        path.join(__dirname, "baseline-schema.sql"),
        "utf8",
      );

      for (const [extensionName, objectNames] of Object.entries(
        EXTENSION_OBJECTS,
      )) {
        const schema = extensions.find(
          ({ name }) => name === extensionName,
        )?.schema;

        if (!schema) {
          throw new Error(
            `The ${extensionName} extension schema could not be determined.`,
          );
        }

        for (const objectName of objectNames) {
          sql = sql.replace(
            new RegExp(`\\bpublic\\.${objectName}\\b`, "g"),
            `${schema}.${objectName}`,
          );
        }
      }

      await queryInterface.sequelize.query(sql, { transaction });
    });
  },

  async down() {
    throw new Error("Baseline migration cannot be automatically reverted.");
  },
};
