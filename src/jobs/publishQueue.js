const { Queue } = require("bullmq");
const { createRedisConnection } = require("../config/redis");

const QUEUE_NAME = "social-publish";

function createPublishQueue() {
  const connection = createRedisConnection();

  const queue = new Queue(QUEUE_NAME, {
    connection,
  });

  return {
    queue,
    connection,
  };
}

async function enqueueSchedule(queue, schedule) {
  const scheduledTime = new Date(schedule.scheduled_at).getTime();
  const delay = Math.max(0, scheduledTime - Date.now());

  const job = await queue.add(
    "publish-schedule",
    {
      scheduleId: schedule.id,
    },
    {
      jobId: `schedule-${schedule.id}`,
      delay,
      attempts: 3,
      backoff: {
        type: "exponential",
        delay: 5000,
      },
      removeOnComplete: false,
      removeOnFail: false,
    }
  );

  return job;
}

module.exports = {
  QUEUE_NAME,
  createPublishQueue,
  enqueueSchedule,
};