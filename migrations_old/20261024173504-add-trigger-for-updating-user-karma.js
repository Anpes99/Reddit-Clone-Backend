"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.query(`
  
DROP TRIGGER IF EXISTS posts_update_user_karma ON posts;
DROP TRIGGER IF EXISTS comments_update_user_karma ON comments;
DROP FUNCTION IF EXISTS update_user_karma_from_votes();

CREATE OR REPLACE FUNCTION update_user_karma_from_rated_votes()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  old_owner_id INTEGER;
  new_owner_id INTEGER;
BEGIN
  IF TG_OP != 'INSERT' THEN
    IF TG_TABLE_NAME = 'user_rated_posts' THEN
      SELECT user_id INTO old_owner_id
      FROM posts
      WHERE id = OLD.post_id;
    ELSE
      SELECT user_id INTO old_owner_id
      FROM comments
      WHERE id = OLD.comment_id;
    END IF;

    IF OLD.user_id != old_owner_id THEN
      UPDATE users
      SET karma = karma - OLD.rating
      WHERE id = old_owner_id;
    END IF;
  END IF;

  IF TG_OP != 'DELETE' THEN
    IF TG_TABLE_NAME = 'user_rated_posts' THEN
      SELECT user_id INTO new_owner_id
      FROM posts
      WHERE id = NEW.post_id;
    ELSE
      SELECT user_id INTO new_owner_id
      FROM comments
      WHERE id = NEW.comment_id;
    END IF;

    IF NEW.user_id != new_owner_id THEN
      UPDATE users
      SET karma = karma + NEW.rating
      WHERE id = new_owner_id;
    END IF;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER user_rated_posts_update_karma
AFTER INSERT OR UPDATE OR DELETE ON "user_rated_posts"
FOR EACH ROW
EXECUTE FUNCTION update_user_karma_from_rated_votes();

CREATE TRIGGER user_rated_comments_update_karma
AFTER INSERT OR UPDATE OR DELETE ON "user_rated_comments"
FOR EACH ROW
EXECUTE FUNCTION update_user_karma_from_rated_votes();


UPDATE users AS u
SET karma =
  COALESCE((
    SELECT SUM(v.rating)
    FROM "user_rated_posts" AS v
    JOIN posts AS p ON p.id = v.post_id
    WHERE p.user_id = u.id
      AND v.user_id != p.user_id
  ), 0)
  +
  COALESCE((
    SELECT SUM(v.rating)
    FROM "user_rated_comments" AS v
    JOIN comments AS c ON c.id = v.comment_id
    WHERE c.user_id = u.id
      AND v.user_id != c.user_id
  ), 0);
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
