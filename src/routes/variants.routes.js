const express = require("express");

const {
  edit,
  approve,
  reject
} = require(
  "../controllers/review.controller"
);

const {
  scheduleVariant
} = require(
  "../controllers/schedules.controller"
);

const router =
  express.Router();

router.patch(
  "/:id",
  edit
);

router.post(
  "/:id/approve",
  approve
);

router.post(
  "/:id/reject",
  reject
);

router.post(
  "/:id/schedule",
  scheduleVariant
);

module.exports = router;