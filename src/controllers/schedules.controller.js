const {
  createSchedule,
  getSchedules
} = require(
  "../services/schedule.service"
);

const {
  createPublishQueue,
  enqueueSchedule
} = require(
  "../jobs/publishQueue"
);

async function scheduleVariant(req, res) {
  const variantId =
    Number(req.params.id);

  if (
    !Number.isInteger(variantId) ||
    variantId <= 0
  ) {
    return res.status(404).json({
      error: "Variant not found"
    });
  }

  const {
    scheduled_at
  } = req.body;

  if (
    typeof scheduled_at !== "string" ||
    scheduled_at.trim().length === 0
  ) {
    return res.status(400).json({
      error:
        "Invalid scheduled_at: scheduled time is required"
    });
  }

  const result =
    createSchedule({
      variantId,
      scheduledAt:
        scheduled_at.trim()
    });

  if (!result.ok) {
    return res
      .status(result.status)
      .json(result);
  }

  const {
    queue,
    connection
  } = createPublishQueue();

  try {
    const job =
      await enqueueSchedule(
        queue,
        result.schedule
      );

    return res
      .status(
        result.reused
          ? 200
          : 201
      )
      .json({
        ...result,
        queue: {
          job_id: job.id,
          status: "queued"
        }
      });
  } catch (error) {
    console.error(
      "[schedule] Queue error:",
      error.message
    );

    return res.status(503).json({
      ok: false,
      status: 503,
      error:
        "Schedule was stored but could not be queued for publishing",
      schedule: result.schedule
    });
  } finally {
    await queue.close();
    await connection.quit();
  }
}

function listSchedules(req, res) {
  return res.status(200).json({
    schedules:
      getSchedules()
  });
}

module.exports = {
  scheduleVariant,
  listSchedules
};