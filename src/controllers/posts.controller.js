const {
  createPost: savePost,
  getPostById
} = require("../services/post.service");

const {
  fetchPostFromUrl
} = require("../services/url.service");

async function createPost(req, res) {
  const {
    source_type,
    source_url,
    title,
    content
  } = req.body;

  // Markdown ingestion
  if (source_type === "markdown") {
    if (
      typeof title !== "string" ||
      title.trim().length === 0
    ) {
      return res.status(400).json({
        error: "Invalid title: title is required"
      });
    }

    if (
      typeof content !== "string" ||
      content.trim().length === 0
    ) {
      return res.status(400).json({
        error:
          "Invalid content: Markdown content is required"
      });
    }

    const post = savePost({
      sourceType: "markdown",
      sourceUrl: null,
      title: title.trim(),
      content: content.trim()
    });

    return res.status(201).json(post);
  }

  // URL ingestion
  if (source_type === "url") {
    if (
      typeof source_url !== "string" ||
      source_url.trim().length === 0
    ) {
      return res.status(400).json({
        error:
          "Invalid source_url: URL is required"
      });
    }

    try {
      const fetchedPost =
        await fetchPostFromUrl(
          source_url.trim()
        );

      const post = savePost({
        sourceType: "url",
        sourceUrl: fetchedPost.sourceUrl,
        title: fetchedPost.title,
        content: fetchedPost.content
      });

      return res.status(201).json(post);
    } catch (error) {
      return res.status(400).json({
        error: error.message
      });
    }
  }

  // Invalid source type
  return res.status(400).json({
    error:
      'Invalid source_type: expected "markdown" or "url"'
  });
}

function readPost(req, res) {
  const id = Number(req.params.id);

  if (
    !Number.isInteger(id) ||
    id <= 0
  ) {
    return res.status(404).json({
      error: "Post not found"
    });
  }

  const post = getPostById(id);

  if (!post) {
    return res.status(404).json({
      error: "Post not found"
    });
  }

  return res.status(200).json(post);
}

module.exports = {
  createPost,
  readPost
};