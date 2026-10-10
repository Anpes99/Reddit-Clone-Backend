"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.query(`
      CREATE INDEX IF NOT EXISTS idx_comment_parent
ON comments (comment_id);

WITH RECURSIVE comment_tree AS (
    SELECT
        id AS descendant_id,
        comment_id AS ancestor_id
    FROM comments
    WHERE comment_id IS NOT NULL

    UNION ALL

    SELECT
        ct.descendant_id,
        parent.comment_id AS ancestor_id
    FROM comment_tree ct
    JOIN comments parent
      ON parent.id = ct.ancestor_id
    WHERE parent.comment_id IS NOT NULL
),
counts AS (
    SELECT ancestor_id AS id, COUNT(*) AS total
    FROM comment_tree
    GROUP BY ancestor_id
)
UPDATE comments c
SET descendant_count = COALESCE(counts.total, 0)
FROM (
    SELECT c2.id, COALESCE(cnt.total, 0) AS total
    FROM comments c2
    LEFT JOIN counts cnt ON cnt.id = c2.id
) counts
WHERE c.id = counts.id;
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
