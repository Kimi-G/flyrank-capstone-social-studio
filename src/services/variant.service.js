const db = require("../db/db");

const {
  getPostById
} = require("./post.service");

const {
  validateVariant
} = require("../validators/variant.validator");

function cleanText(value) {
  return value
    .replace(/#{1,6}\s*/g, "")
    .replace(/\*\*/g, "")
    .replace(/\*/g, "")
    .replace(/`/g, "")
    .replace(/\[(.*?)\]\(.*?\)/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

function truncateText(value, maxLength) {
  if (value.length <= maxLength) {
    return value;
  }

  return (
    value
      .slice(0, maxLength - 3)
      .trimEnd() + "..."
  );
}

function buildXVariant(post) {
  const title =
    cleanText(post.title)
      .replace(/[.!?]+$/g, "");

  const sourceContent =
    cleanText(post.content);

  const summary =
    truncateText(sourceContent, 155);

  return `${title}: ${summary} #Backend #Tech`;
}

function buildLinkedInVariant(post) {
  const title =
    cleanText(post.title);

  const sourceContent =
    cleanText(post.content);

  const summary =
    truncateText(sourceContent, 700);

  return `${title}

${summary}

A useful reminder for engineering teams: reliable systems should remain predictable even when work is retried or interrupted.

#SoftwareEngineering #BackendDevelopment #Reliability`;
}

function saveVariant({
  postId,
  platform,
  content,
  validation
}) {
  const now =
    new Date().toISOString();

  const result = db
    .prepare(`
      INSERT INTO variants (
        post_id,
        platform,
        content,
        status,
        validation_result,
        created_at,
        updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `)
    .run(
      postId,
      platform,
      content,
      "draft",
      JSON.stringify(validation),
      now,
      now
    );

  return getVariantById(
    Number(result.lastInsertRowid)
  );
}

function getVariantById(id) {
  const variant = db
    .prepare(`
      SELECT
        id,
        post_id,
        platform,
        content,
        status,
        validation_result,
        created_at,
        updated_at
      FROM variants
      WHERE id = ?
    `)
    .get(id);

  if (!variant) {
    return null;
  }

  return {
    ...variant,
    validation_result:
      variant.validation_result
        ? JSON.parse(
            variant.validation_result
          )
        : null
  };
}

function getVariantsByPostId(postId) {
  const variants = db
    .prepare(`
      SELECT
        id,
        post_id,
        platform,
        content,
        status,
        validation_result,
        created_at,
        updated_at
      FROM variants
      WHERE post_id = ?
      ORDER BY id
    `)
    .all(postId);

  return variants.map((variant) => ({
    ...variant,
    validation_result:
      variant.validation_result
        ? JSON.parse(
            variant.validation_result
          )
        : null
  }));
}

function generateVariantsForPost(postId) {
  const post =
    getPostById(postId);

  if (!post) {
    return {
      ok: false,
      status: 404,
      error: "Post not found"
    };
  }

  const candidates = [
    {
      platform: "x",
      content:
        buildXVariant(post)
    },
    {
      platform: "linkedin",
      content:
        buildLinkedInVariant(post)
    }
  ];

  const invalidVariants = [];

  for (const candidate of candidates) {
    const validation =
      validateVariant(
        candidate.platform,
        candidate.content
      );

    if (!validation.valid) {
      invalidVariants.push({
        platform:
          candidate.platform,
        errors:
          validation.errors
      });
    }
  }

  if (invalidVariants.length > 0) {
    return {
      ok: false,
      status: 422,
      error:
        "Generated variant failed constraint validation",
      invalid_variants:
        invalidVariants
    };
  }

  const savedVariants =
    candidates.map((candidate) => {
      const validation =
        validateVariant(
          candidate.platform,
          candidate.content
        );

      return saveVariant({
        postId: post.id,
        platform:
          candidate.platform,
        content:
          candidate.content,
        validation
      });
    });

  return {
    ok: true,
    post_id: post.id,
    variants: savedVariants
  };
}

module.exports = {
  generateVariantsForPost,
  getVariantsByPostId,
  getVariantById
};