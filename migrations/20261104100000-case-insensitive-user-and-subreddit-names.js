"use strict";

const CASE_INSENSITIVE_COLUMNS = [
  { table: "users", column: "username" },
  { table: "subreddits", column: "name" },
  { table: "users", column: "email" },
];

/**
 * @param {import("../types/migration").QueryInterface} queryInterface
 * @param {import("../types/migration").TableColumn} tableColumn
 * @param {import("../types/migration").Transaction} transaction
 */
const assertNoCaseInsensitiveDuplicates = async (
  queryInterface,
  { table, column },
  transaction,
) => {
  const [duplicates] =
    /** @type {import("../types/migration").RawQueryResult<{ value: string, ids: number[] }>} */ (
      await queryInterface.sequelize.query(
        `
      SELECT LOWER(TRIM(${column})) AS value, array_agg(id ORDER BY id) AS ids
      FROM public.${table}
      WHERE ${column} IS NOT NULL
      GROUP BY LOWER(TRIM(${column}))
      HAVING COUNT(*) > 1;
    `,
        { transaction },
      )
    );

  if (duplicates.length > 0) {
    const list = duplicates
      .map(({ value, ids }) => `"${value}" (ids ${ids.join(", ")})`)
      .join("; ");
    throw new Error(
      `${table}.${column} has values that only differ by case: ${list}`,
    );
  }
};

/** @type {import("../types/migration").Migration} */
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      for (const column of CASE_INSENSITIVE_COLUMNS) {
        await assertNoCaseInsensitiveDuplicates(
          queryInterface,
          column,
          transaction,
        );
      }

      await queryInterface.sequelize.query(
        "CREATE EXTENSION IF NOT EXISTS citext;",
        { transaction },
      );
      const [[{ schema }]] =
        /** @type {import("../types/migration").RawQueryResult<{ schema: string }>} */ (
          await queryInterface.sequelize.query(
            `
          SELECT quote_ident(namespace.nspname) AS schema
          FROM pg_catalog.pg_extension extension
          JOIN pg_catalog.pg_namespace namespace
            ON namespace.oid = extension.extnamespace
          WHERE extension.extname = 'citext';
        `,
            { transaction },
          )
        );

      await queryInterface.sequelize.query(
        `ALTER TABLE public.users ALTER COLUMN username TYPE ${schema}.citext;`,
        { transaction },
      );
      await queryInterface.sequelize.query(
        `ALTER TABLE public.subreddits ALTER COLUMN name TYPE ${schema}.citext;`,
        { transaction },
      );

      await queryInterface.sequelize.query(
        `
          UPDATE public.users
          SET email = LOWER(TRIM(email))
          WHERE email <> LOWER(TRIM(email));
        `,
        { transaction },
      );
      await queryInterface.sequelize.query(
        `
          ALTER TABLE public.users
            ADD CONSTRAINT users_email_lowercase CHECK (email = LOWER(email));
        `,
        { transaction },
      );
      await queryInterface.sequelize.query(
        `
          CREATE UNIQUE INDEX users_email_lower_key
            ON public.users USING btree (LOWER(email));
        `,
        { transaction },
      );
    });
  },

  async down(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.sequelize.query(
        "DROP INDEX public.users_email_lower_key;",
        { transaction },
      );
      await queryInterface.sequelize.query(
        "ALTER TABLE public.users DROP CONSTRAINT users_email_lowercase;",
        { transaction },
      );
      await queryInterface.sequelize.query(
        `
          ALTER TABLE public.subreddits
            ALTER COLUMN name TYPE character varying(255);
        `,
        { transaction },
      );
      await queryInterface.sequelize.query(
        `
          ALTER TABLE public.users
            ALTER COLUMN username TYPE character varying(255);
        `,
        { transaction },
      );
    });
  },
};
