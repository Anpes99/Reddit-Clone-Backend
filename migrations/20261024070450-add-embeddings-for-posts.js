"use strict";

const { generateEmbedding } = require("../utils/embeddings");

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.query(
      `
        CREATE EXTENSION IF NOT EXISTS vector;

        ALTER TABLE posts
        ADD COLUMN IF NOT EXISTS embedding vector(512);

        CREATE INDEX IF NOT EXISTS posts_embedding_idx
        ON posts USING hnsw (embedding vector_cosine_ops);
      
      `,
    );

    const [posts] = await queryInterface.sequelize.query(
      'SELECT id, title, text FROM "posts"',
    );

    for (const post of posts) {
      console.log("updating ", post.id);
      const textForEmbedding = `${post.title ?? ""}\n\n${post.text ?? ""}`;

      const embedding = await generateEmbedding(textForEmbedding, "document");
      console.log("2");

      await queryInterface.sequelize.query(
        'UPDATE "posts" SET embedding = CAST(:embedding AS vector) WHERE id = :id',
        {
          replacements: {
            embedding: JSON.stringify(embedding),
            id: post.id,
          },
        },
      );
    }

    await queryInterface.sequelize.query(
      `   
      ALTER TABLE posts
      ALTER COLUMN embedding SET NOT NULL;
      
      `,
    );

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
