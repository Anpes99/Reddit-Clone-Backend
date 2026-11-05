"use strict";

/** @type {import("../types/migration").Migration} */
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
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
          CREATE TABLE public.user_notifications (
            id serial PRIMARY KEY,
            user_id integer NOT NULL
              REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE,
            type public.enum_user_notifications_type NOT NULL,
            title character varying(255) NOT NULL,
            message text NOT NULL,
            is_read boolean DEFAULT false,
            delivered_at timestamp with time zone,
            created_at timestamp with time zone NOT NULL,
            updated_at timestamp with time zone NOT NULL
          );
        `,
        { transaction },
      );

      await queryInterface.sequelize.query(
        `
          CREATE INDEX user_notifications_user_id
            ON public.user_notifications USING btree (user_id);
        `,
        { transaction },
      );
    });
  },

  async down(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.sequelize.query(
        "DROP TABLE public.user_notifications;",
        { transaction },
      );

      await queryInterface.sequelize.query(
        "DROP TYPE public.enum_user_notifications_type;",
        { transaction },
      );
    });
  },
};
