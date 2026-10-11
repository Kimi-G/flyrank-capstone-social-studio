require("dotenv").config();

const {
  createPublishQueue,
  enqueueSchedule,
} = require("../src/jobs/publishQueue");

async function run() {
  const { queue, connection } = createPublishQueue();

  try {
    const testSchedule = {
      id: 999999,
      scheduled_at: new Date(Date.now() + 60000).toISOString(),
    };

    const existingJob = await queue.getJob(
      `schedule-${testSchedule.id}`
    );

    if (existingJob) {
      await existingJob.remove();
    }

    const firstJob = await enqueueSchedule(queue, testSchedule);
    const secondJob = await enqueueSchedule(queue, testSchedule);

    console.log("BULLMQ QUEUE OK");
    console.log({
      firstJobId: firstJob.id,
      secondJobId: secondJob.id,
      sameJobId: firstJob.id === secondJob.id,
    });

    const storedJob = await queue.getJob(
      `schedule-${testSchedule.id}`
    );

    console.log({
      storedInRedis: Boolean(storedJob),
      scheduleId: storedJob?.data.scheduleId,
    });

    if (storedJob) {
      await storedJob.remove();
    }
  } finally {
    await queue.close();
    await connection.quit();
  }
}

run().catch((error) => {
  console.error("Queue test failed:", error.message);
  process.exitCode = 1;
});