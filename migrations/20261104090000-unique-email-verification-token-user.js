"use strict";

module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.sequelize.query(
        `
          DELETE FROM public.email_verification_tokens token
          USING public.email_verification_tokens newer_token
          WHERE newer_token.user_id = token.user_id
            AND newer_token.id > token.id;
        `,
        { transaction },
      );

      await queryInterface.sequelize.query(
        `
          ALTER TABLE public.email_verification_tokens
            ADD CONSTRAINT email_verification_tokens_user_id_key UNIQUE (user_id);
        `,
        { transaction },
      );
    });
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(
      `
        ALTER TABLE public.email_verification_tokens
          DROP CONSTRAINT email_verification_tokens_user_id_key;
      `,
    );
  },
};
