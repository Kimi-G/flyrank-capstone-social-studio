const IORedis = require("ioredis");

function createRedisConnection() {
  const redisUrl =
    process.env.REDIS_URL || "redis://127.0.0.1:6379";

  return new IORedis(redisUrl, {
    maxRetriesPerRequest: null,
  });
}

module.exports = {
  createRedisConnection,
};