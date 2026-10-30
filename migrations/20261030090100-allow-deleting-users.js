"use strict";

// Users with a password reset token could not be deleted; reset tokens now go
// with the user. A subreddit's creator still cannot be deleted until the
// subreddit is handed over, and creator_id no longer defaults to user 1.

// The existing constraints may have other names in some databases, so they are
// found by column instead of by name.
const dropForeignKeysOnColumn = async (
  queryInterface,
  { table, column },
  transaction,
) => {
  const [constraints] = await queryInterface.sequelize.query(
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
  );

  for (const { name } of constraints) {
    await queryInterface.sequelize.query(
      `ALTER TABLE public.${table} DROP CONSTRAINT ${name};`,
      { transaction },
    );
  }
};

const setUserForeignKeys = async (
  queryInterface,
  { passwordResetTokensOnDelete, subredditsCreatorOnDelete },
  transaction,
) => {
  await dropForeignKeysOnColumn(
    queryInterface,
    { table: "password_reset_tokens", column: "user_id" },
    transaction,
  );
  await queryInterface.sequelize.query(
    `
      ALTER TABLE public.password_reset_tokens
        ADD CONSTRAINT password_reset_tokens_user_id_fkey
          FOREIGN KEY (user_id) REFERENCES public.users(id)
          ON UPDATE CASCADE ON DELETE ${passwordResetTokensOnDelete};
    `,
    { transaction },
  );

  await dropForeignKeysOnColumn(
    queryInterface,
    { table: "subreddits", column: "creator_id" },
    transaction,
  );
  await queryInterface.sequelize.query(
    `
      ALTER TABLE public.subreddits
        ADD CONSTRAINT subreddits_creator_id_fkey
          FOREIGN KEY (creator_id) REFERENCES public.users(id)
          ON UPDATE CASCADE ON DELETE ${subredditsCreatorOnDelete};
    `,
    { transaction },
  );
};

module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await setUserForeignKeys(
        queryInterface,
        {
          passwordResetTokensOnDelete: "CASCADE",
          subredditsCreatorOnDelete: "RESTRICT",
        },
        transaction,
      );

      await queryInterface.sequelize.query(
        `
          ALTER TABLE public.subreddits
            ALTER COLUMN creator_id DROP DEFAULT,
            ALTER COLUMN creator_id SET NOT NULL;
        `,
        { transaction },
      );
    });
  },

  async down(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await setUserForeignKeys(
        queryInterface,
        {
          passwordResetTokensOnDelete: "NO ACTION",
          subredditsCreatorOnDelete: "NO ACTION",
        },
        transaction,
      );

      await queryInterface.sequelize.query(
        "ALTER TABLE public.subreddits ALTER COLUMN creator_id SET DEFAULT 1;",
        { transaction },
      );
    });
  },
};
