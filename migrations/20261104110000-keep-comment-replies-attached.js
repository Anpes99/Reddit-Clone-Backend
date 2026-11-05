"use strict";

// Deleting a comment used to set its replies' comment_id to NULL, leaving them
// attached to nothing. A comment with replies can no longer be deleted.

// The existing constraint may have another name in some databases, so it is
// found by column instead of by name.
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

/**
 * @param {import("../types/migration").QueryInterface} queryInterface
 * @param {string} onDelete
 * @param {import("../types/migration").Transaction} transaction
 */
const setCommentParentForeignKey = async (
  queryInterface,
  onDelete,
  transaction,
) => {
  await dropForeignKeysOnColumn(
    queryInterface,
    { table: "comments", column: "comment_id" },
    transaction,
  );
  await queryInterface.sequelize.query(
    `
      ALTER TABLE public.comments
        ADD CONSTRAINT comments_comment_id_fkey
          FOREIGN KEY (comment_id) REFERENCES public.comments(id)
          ON UPDATE CASCADE ON DELETE ${onDelete};
    `,
    { transaction },
  );
};

/** @type {import("../types/migration").Migration} */
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await setCommentParentForeignKey(queryInterface, "RESTRICT", transaction);
    });
  },

  async down(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await setCommentParentForeignKey(queryInterface, "SET NULL", transaction);
    });
  },
};
