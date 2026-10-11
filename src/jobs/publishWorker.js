require("dotenv").config();

const {
  Worker
} = require("bullmq");

const {
  createRedisConnection
} = require(
  "../config/redis"
);

const {
  QUEUE_NAME
} = require(
  "./publishQueue"
);

const {
  reconcileSchedules
} = require(
  "./reconcileSchedules"
);

const {
  publishSchedule
} = require(
  "../services/publish.service"
);

async function startWorker() {
  const reconciliation =
    await reconcileSchedules();

  console.log(
    `[worker] Reconciliation complete: ${reconciliation.found} recoverable schedule(s), ${reconciliation.queued} queued`
  );

  const connection =
    createRedisConnection();

  const worker = new Worker(
    QUEUE_NAME,
    async (job) => {
      console.log(
        `[worker] Processing job ${job.id} for schedule ${job.data.scheduleId}`
      );

      const result =
  await publishSchedule(
    job.data.scheduleId
  );

if (!result.ok) {
  throw new Error(
    result.details ||
    result.error ||
    `Publish failed for schedule ${job.data.scheduleId}`
  );
}

console.log(
  `[worker] Published schedule ${job.data.scheduleId}`
);

return result;
    },
    {
      connection,
      concurrency: 1,

      lockDuration: 10000,
      stalledInterval: 5000,
      maxStalledCount: 2
    }
  );

  worker.on("ready", () => {
    console.log(
      `[worker] Listening on queue "${QUEUE_NAME}"`
    );
  });

  worker.on(
    "completed",
    (job) => {
      console.log(
        `[worker] Job ${job.id} completed`
      );
    }
  );

  worker.on(
    "failed",
    (job, error) => {
      console.error(
        `[worker] Job ${job?.id} failed:`,
        error.message
      );
    }
  );

  worker.on(
    "stalled",
    (jobId) => {
      console.warn(
        `[worker] Job ${jobId} stalled`
      );
    }
  );

  worker.on(
    "error",
    (error) => {
      console.error(
        "[worker] Error:",
        error.message
      );
    }
  );

  async function shutdown(signal) {
    console.log(
      `\n[worker] ${signal} received. Shutting down...`
    );

    await worker.close();
    await connection.quit();

    console.log(
      "[worker] Shutdown complete"
    );

    process.exit(0);
  }

  process.on(
    "SIGINT",
    () => shutdown("SIGINT")
  );

  process.on(
    "SIGTERM",
    () => shutdown("SIGTERM")
  );
}

startWorker().catch((error) => {
  console.error(
    "[worker] Startup failed:",
    error.message
  );

  process.exitCode = 1;
});