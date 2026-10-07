const db = require("../db/db");

function createPost({
  sourceType,
  sourceUrl = null,
  title,
  content
}) {
  const createdAt = new Date().toISOString();

  const result = db
    .prepare(`
      INSERT INTO posts (
        source_type,
        source_url,
        title,
        content,
        created_at
      )
      VALUES (?, ?, ?, ?, ?)
    `)
    .run(
      sourceType,
      sourceUrl,
      title,
      content,
      createdAt
    );

  return getPostById(
    Number(result.lastInsertRowid)
  );
}

function getPostById(id) {
  const post = db
    .prepare(`
      SELECT
        id,
        source_type,
        source_url,
        title,
        content,
        created_at
      FROM posts
      WHERE id = ?
    `)
    .get(id);

  return post ? { ...post } : null;
}

module.exports = {
  createPost,
  getPostById
};