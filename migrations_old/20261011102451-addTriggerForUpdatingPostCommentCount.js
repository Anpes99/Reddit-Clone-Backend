"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.query(`
      

BEGIN;



UPDATE posts AS p
SET comment_count = (
    SELECT COUNT(*)
    FROM comments AS c
    WHERE c.post_id = p.id
);




    CREATE OR REPLACE FUNCTION maintain_post_comment_count()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE posts
        SET comment_count = comment_count + 1
        WHERE id = NEW.post_id;

    ELSIF TG_OP = 'DELETE' THEN
        UPDATE posts
        SET comment_count = comment_count - 1
        WHERE id = OLD.post_id;
    END IF;

    RETURN NULL;
END;
$$;

CREATE TRIGGER comments_maintain_post_comment_count
AFTER INSERT OR DELETE ON comments
FOR EACH ROW
EXECUTE FUNCTION maintain_post_comment_count();




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
