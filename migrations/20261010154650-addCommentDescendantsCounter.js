"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.query(`
      CREATE OR REPLACE FUNCTION increment_comment_ancestors()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    WITH RECURSIVE ancestors AS (
        SELECT id, comment_id
        FROM comments
        WHERE id = NEW.comment_id

        UNION ALL

        SELECT c.id, c.comment_id
        FROM comments c
        JOIN ancestors a
          ON c.id = a.comment_id
    )
    UPDATE comments c
    SET descendant_count = c.descendant_count + 1
    WHERE c.id IN (SELECT id FROM ancestors);

    RETURN NEW;
END;
$$;

CREATE TRIGGER comment_after_insert
AFTER INSERT ON comments
FOR EACH ROW
EXECUTE FUNCTION increment_comment_ancestors();






CREATE OR REPLACE FUNCTION decrement_comment_ancestors()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    WITH RECURSIVE ancestors AS (
        SELECT id, comment_id
        FROM comments
        WHERE id = OLD.comment_id

        UNION ALL

        SELECT c.id, c.comment_id
        FROM comments c
        JOIN ancestors a
          ON c.id = a.comment_id
    )
    UPDATE comments c
    SET descendant_count = c.descendant_count - 1
    WHERE c.id IN (SELECT id FROM ancestors);

    RETURN OLD;
END;
$$;

CREATE TRIGGER comment_after_delete
AFTER DELETE ON comments
FOR EACH ROW
EXECUTE FUNCTION decrement_comment_ancestors();


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
