require("dotenv").config();

const {
  createRedisConnection,
} = require("../src/config/redis");

async function run() {
  const connection = createRedisConnection();

  try {
    const result = await connection.ping();

    console.log("REDIS CONNECTION OK");
    console.log({
      ping: result,
    });
  } finally {
    await connection.quit();
  }
}

run().catch((error) => {
  console.error("Redis test failed:", error.message);
  process.exitCode = 1;
});