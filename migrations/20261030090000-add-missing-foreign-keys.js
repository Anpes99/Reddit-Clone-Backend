"use strict";

const FOREIGN_KEYS = [
  {
    table: "posts",
    column: "subreddit_id",
    references: "subreddits",
    onDelete: "CASCADE",
  },
  {
    table: "comments",
    column: "user_id",
    references: "users",
    onDelete: "SET NULL",
  },
  {
    table: "user_rated_posts",
    column: "user_id",
    references: "users",
    onDelete: "CASCADE",
  },
  {
    table: "user_rated_comments",
    column: "user_id",
    references: "users",
    onDelete: "CASCADE",
  },
  {
    table: "user_subreddits",
    column: "user_id",
    references: "users",
    onDelete: "CASCADE",
  },
  {
    table: "user_subreddits",
    column: "subreddit_id",
    references: "subreddits",
    onDelete: "CASCADE",
  },
];

// Postgres does not index foreign key columns automatically. These columns
// are not the leading column of any existing index.
const FOREIGN_KEY_INDEXES = [
  { table: "posts", column: "subreddit_id" },
  { table: "comments", column: "user_id" },
];

/** @param {import("../types/migration").TableColumn} foreignKey */
const constraintName = ({ table, column }) => `${table}_${column}_fkey`;
/** @param {import("../types/migration").TableColumn} foreignKey */
const indexName = ({ table, column }) => `${table}_${column}_idx`;

// Some databases already have a foreign key on these columns, possibly under
// another name or with other rules. Dropping whatever exists before adding the
// intended constraint gives every database the same end state.
/**
 * @param {import("../types/migration").QueryInterface} queryInterface
 * @param {import("../types/migration").TableColumn} foreignKey
 * @param {import("../types/migration").Transaction} transaction
 */
const dropForeignKeysOnColumn = async (
  queryInterface,
  { table, column },
  transaction,
) => {
  const [constraints] =
    /** @type {import("../types/migration").RawQueryResult<{ name: string }>} */ (
      await queryInterface.sequelize.query(
        `
      SELECT quote_ident(constraint_info.conname) AS name
      FROM pg_catalog.pg_constraint constraint_info
      JOIN pg_catalog.pg_attribute attribute
        ON attribute.attrelid = constraint_info.conrelid
        AND attribute.attnum = ANY (constraint_info.conkey)
      WHERE constraint_info.contype = 'f'
        AND constraint_info.conrelid = CAST(:table AS regclass)
        AND attribute.attname = :column;
    `,
        { replacements: { table: `public.${table}`, column }, transaction },
      )
    );

  for (const { name } of constraints) {
    await queryInterface.sequelize.query(
      `ALTER TABLE public.${table} DROP CONSTRAINT ${name};`,
      { transaction },
    );
  }
};

/** @type {import("../types/migration").Migration} */
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      const orphans = [];
      for (const foreignKey of FOREIGN_KEYS) {
        const [[{ count }]] =
          /** @type {import("../types/migration").RawQueryResult<{ count: number }>} */ (
            await queryInterface.sequelize.query(
              `
            SELECT COUNT(*)::integer AS count
            FROM public.${foreignKey.table} child
            WHERE child.${foreignKey.column} IS NOT NULL
              AND NOT EXISTS (
                SELECT 1 FROM public.${foreignKey.references} parent
                WHERE parent.id = child.${foreignKey.column}
              );
          `,
              { transaction },
            )
          );
        if (count > 0) {
          orphans.push(
            `${foreignKey.table}.${foreignKey.column}: ${count} row(s) reference a missing ${foreignKey.references}.id`,
          );
        }
      }

      if (orphans.length > 0) {
        throw new Error(
          `Clean up orphaned rows before adding foreign keys:\n${orphans.join("\n")}`,
        );
      }

      for (const foreignKey of FOREIGN_KEYS) {
        await dropForeignKeysOnColumn(queryInterface, foreignKey, transaction);
        await queryInterface.sequelize.query(
          `
            ALTER TABLE public.${foreignKey.table}
            ADD CONSTRAINT ${constraintName(foreignKey)}
            FOREIGN KEY (${foreignKey.column})
            REFERENCES public.${foreignKey.references}(id)
            ON UPDATE CASCADE ON DELETE ${foreignKey.onDelete};
          `,
          { transaction },
        );
      }

      for (const index of FOREIGN_KEY_INDEXES) {
        await queryInterface.sequelize.query(
          `CREATE INDEX IF NOT EXISTS ${indexName(index)} ON public.${index.table} USING btree (${index.column});`,
          { transaction },
        );
      }
    });
  },

  async down(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      for (const index of FOREIGN_KEY_INDEXES) {
        await queryInterface.sequelize.query(
          `DROP INDEX IF EXISTS public.${indexName(index)};`,
          { transaction },
        );
      }

      for (const foreignKey of FOREIGN_KEYS) {
        await queryInterface.sequelize.query(
          `ALTER TABLE public.${foreignKey.table} DROP CONSTRAINT IF EXISTS ${constraintName(foreignKey)};`,
          { transaction },
        );
      }
    });
  },
};
