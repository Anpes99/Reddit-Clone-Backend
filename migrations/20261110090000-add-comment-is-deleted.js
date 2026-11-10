"use strict";

// Deleted comments are kept so their replies stay attached; this flag marks them.

/** @type {import("../types/migration").Migration} */
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(`
      ALTER TABLE public.comments
        ADD COLUMN is_deleted boolean NOT NULL DEFAULT false;
    `);
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(`
      ALTER TABLE public.comments DROP COLUMN is_deleted;
    `);
  },
};
