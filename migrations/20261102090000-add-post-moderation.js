"use strict";

/** @type {import("../types/migration").Migration} */
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.sequelize.query(
        `
          CREATE TYPE public.enum_posts_moderation_status AS ENUM (
            'pending',
            'completed',
            'failed',
            'review_required'
          );
        `,
        { transaction },
      );

      await queryInterface.sequelize.query(
        `
          ALTER TABLE public.posts
            ADD COLUMN safe boolean,
            ADD COLUMN moderation_status public.enum_posts_moderation_status;
        `,
        { transaction },
      );

      await queryInterface.sequelize.query(
        `
          UPDATE posts SET safe = true, moderation_status = 'completed'
        `,
        { transaction },
      );
    });
  },

  async down(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.sequelize.query(
        `
          ALTER TABLE public.posts
            DROP COLUMN moderation_status,
            DROP COLUMN safe;
        `,
        { transaction },
      );

      await queryInterface.sequelize.query(
        "DROP TYPE public.enum_posts_moderation_status;",
        { transaction },
      );
    });
  },
};
