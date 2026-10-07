const express =
  require("express");

const {
  listSchedules
} = require(
  "../controllers/schedules.controller"
);

const router =
  express.Router();

router.get(
  "/",
  listSchedules
);

module.exports = router;