const {
  getRecoverableSchedules
} = require(
  "../services/schedule.service"
);

const {
  createPublishQueue,
  enqueueSchedule
} = require(
  "./publishQueue"
);

async function reconcileSchedules() {
  const schedules =
    getRecoverableSchedules();

  const {
    queue,
    connection
  } = createPublishQueue();

  let queued = 0;

  try {
    for (
      const schedule
      of schedules
    ) {
      await enqueueSchedule(
        queue,
        schedule
      );

      queued += 1;
    }

    return {
      found: schedules.length,
      queued
    };
  } finally {
    await queue.close();
    await connection.quit();
  }
}

module.exports = {
  reconcileSchedules
};