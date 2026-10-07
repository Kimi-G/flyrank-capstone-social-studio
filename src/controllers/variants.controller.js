const {
  generateVariantsForPost,
  getVariantsByPostId
} = require("../services/variant.service");

function generateVariants(req, res) {
  const postId =
    Number(req.params.id);

  if (
    !Number.isInteger(postId) ||
    postId <= 0
  ) {
    return res.status(404).json({
      error: "Post not found"
    });
  }

  const result =
    generateVariantsForPost(postId);

  if (!result.ok) {
    return res
      .status(result.status)
      .json(result);
  }

  return res
    .status(201)
    .json(result);
}

function listVariants(req, res) {
  const postId =
    Number(req.params.id);

  if (
    !Number.isInteger(postId) ||
    postId <= 0
  ) {
    return res.status(404).json({
      error: "Post not found"
    });
  }

  const variants =
    getVariantsByPostId(postId);

  return res.status(200).json({
    post_id: postId,
    variants
  });
}

module.exports = {
  generateVariants,
  listVariants
};