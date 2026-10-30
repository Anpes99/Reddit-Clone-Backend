"use strict";

// Users with a password reset token could not be deleted; reset tokens now go
// with the user. A subreddit's creator still cannot be deleted until the
// subreddit is handed over, and creator_id no longer defaults to user 1.
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.sequelize.query(
        `
          ALTER TABLE public.password_reset_tokens
            DROP CONSTRAINT password_reset_tokens_user_id_fkey,
            ADD CONSTRAINT password_reset_tokens_user_id_fkey
              FOREIGN KEY (user_id) REFERENCES public.users(id)
              ON UPDATE CASCADE ON DELETE CASCADE;
        `,
        { transaction },
      );

      await queryInterface.sequelize.query(
        `
          ALTER TABLE public.subreddits
            ALTER COLUMN creator_id DROP DEFAULT,
            DROP CONSTRAINT subreddits_creator_id_fkey,
            ADD CONSTRAINT subreddits_creator_id_fkey
              FOREIGN KEY (creator_id) REFERENCES public.users(id)
              ON UPDATE CASCADE ON DELETE RESTRICT;
        `,
        { transaction },
      );
    });
  },

  async down(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.sequelize.query(
        `
          ALTER TABLE public.subreddits
            DROP CONSTRAINT subreddits_creator_id_fkey,
            ADD CONSTRAINT subreddits_creator_id_fkey
              FOREIGN KEY (creator_id) REFERENCES public.users(id),
            ALTER COLUMN creator_id SET DEFAULT 1;
        `,
        { transaction },
      );

      await queryInterface.sequelize.query(
        `
          ALTER TABLE public.password_reset_tokens
            DROP CONSTRAINT password_reset_tokens_user_id_fkey,
            ADD CONSTRAINT password_reset_tokens_user_id_fkey
              FOREIGN KEY (user_id) REFERENCES public.users(id)
              ON UPDATE CASCADE;
        `,
        { transaction },
      );
    });
  },
};
