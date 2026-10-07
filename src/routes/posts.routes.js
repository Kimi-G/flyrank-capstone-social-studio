const express = require("express");

const {
  createPost,
  readPost
} = require("../controllers/posts.controller");

const {
  generateVariants,
  listVariants
} = require("../controllers/variants.controller");

const router = express.Router();

router.post("/", createPost);

router.get("/:id", readPost);

router.post(
  "/:id/variants",
  generateVariants
);

router.get(
  "/:id/variants",
  listVariants
);

module.exports = router;