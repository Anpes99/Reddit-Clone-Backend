"use strict";

/** @type {import("../types/migration").Migration} */
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(
      `
        ALTER TYPE public.enum_user_notifications_type
          ADD VALUE IF NOT EXISTS 'community_created';
      `,
    );
  },

  async down(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.sequelize.query(
        "DELETE FROM public.user_notifications WHERE type = 'community_created';",
        { transaction },
      );

      await queryInterface.sequelize.query(
        `
          ALTER TYPE public.enum_user_notifications_type
            RENAME TO enum_user_notifications_type_old;
        `,
        { transaction },
      );

      await queryInterface.sequelize.query(
        `
          CREATE TYPE public.enum_user_notifications_type AS ENUM (
            'post_removed',
            'image_removed',
            'post_approved',
            'post_rejected',
            'comment_reply',
            'comment_removed',
            'new_follower',
            'post_upvote',
            'comment_upvote',
            'moderation_warning',
            'moderation_update',
            'system'
          );
        `,
        { transaction },
      );

      await queryInterface.sequelize.query(
        `
          ALTER TABLE public.user_notifications
            ALTER COLUMN type TYPE public.enum_user_notifications_type
            USING type::text::public.enum_user_notifications_type;
        `,
        { transaction },
      );

      await queryInterface.sequelize.query(
        "DROP TYPE public.enum_user_notifications_type_old;",
        { transaction },
      );
    });
  },
};
