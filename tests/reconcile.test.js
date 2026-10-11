require("dotenv").config();

const {
  reconcileSchedules
} = require(
  "../src/jobs/reconcileSchedules"
);

const {
  getRecoverableSchedules
} = require(
  "../src/services/schedule.service"
);

const {
  createPublishQueue
} = require(
  "../src/jobs/publishQueue"
);

async function run() {
  const result =
    await reconcileSchedules();

  console.log(
    "RECONCILIATION RESULT"
  );

  console.log(result);

  const schedules =
    getRecoverableSchedules();

  const {
    queue,
    connection
  } = createPublishQueue();

  try {
    const missing = [];

    for (
      const schedule
      of schedules
    ) {
      const job =
        await queue.getJob(
          `schedule-${schedule.id}`
        );

      if (!job) {
        missing.push(
          schedule.id
        );
      }
    }

    console.log(
      "QUEUE RECOVERY CHECK"
    );

    console.log({
      recoverableSchedules:
        schedules.length,
      missingJobs:
        missing
    });

    if (missing.length > 0) {
      throw new Error(
        `Missing BullMQ jobs for schedules: ${missing.join(", ")}`
      );
    }

    console.log(
      "RECONCILIATION OK"
    );
  } finally {
    await queue.close();
    await connection.quit();
  }
}

run().catch((error) => {
  console.error(
    "Reconciliation test failed:",
    error.message
  );

  process.exitCode = 1;
});