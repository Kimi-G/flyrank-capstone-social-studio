const express =
  require("express");

const {
  history,
  mockPreview
} = require(
  "../controllers/publish.controller"
);

const router =
  express.Router();

router.get(
  "/history",
  history
);

router.get(
  "/mock-publications",
  mockPreview
);

module.exports = router;