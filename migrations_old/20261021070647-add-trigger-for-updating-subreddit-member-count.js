"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.query(`
      

BEGIN;



UPDATE subreddits AS s
SET member_count = (
    SELECT COUNT(*)
    FROM user_subreddits AS us
    WHERE us.subreddit_id = s.id
);




    CREATE OR REPLACE FUNCTION maintain_subreddit_member_count()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE subreddits
        SET member_count = member_count + 1
        WHERE id = NEW.subreddit_id;

    ELSIF TG_OP = 'DELETE' THEN
        UPDATE subreddits
        SET member_count = member_count - 1
        WHERE id = OLD.subreddit_id;
    END IF;

    RETURN NULL;
END;
$$;

CREATE TRIGGER user_subreddits_maintain_subreddit_member_count
AFTER INSERT OR DELETE ON user_subreddits
FOR EACH ROW
EXECUTE FUNCTION maintain_subreddit_member_count();




COMMIT;









    `);

    /**
     * Add altering commands here.
     *
     * Example:
     * await queryInterface.createTable('users', { id: Sequelize.INTEGER });
     */
  },

  async down(queryInterface, Sequelize) {
    /**
     * Add reverting commands here.
     *
     * Example:
     * await queryInterface.dropTable('users');
     */
  },
};
