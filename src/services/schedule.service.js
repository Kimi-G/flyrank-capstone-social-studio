const db = require("../db/db");

const {
  getVariantById
} = require("./variant.service");

function getScheduleById(id) {
  const schedule = db
    .prepare(`
      SELECT
        id,
        variant_id,
        scheduled_at,
        status,
        idempotency_key,
        created_at,
        published_at
      FROM schedule_slots
      WHERE id = ?
    `)
    .get(id);

  return schedule
    ? { ...schedule }
    : null;
}

function getScheduleByKey(
  idempotencyKey
) {
  const schedule = db
    .prepare(`
      SELECT
        id,
        variant_id,
        scheduled_at,
        status,
        idempotency_key,
        created_at,
        published_at
      FROM schedule_slots
      WHERE idempotency_key = ?
    `)
    .get(idempotencyKey);

  return schedule
    ? { ...schedule }
    : null;
}

function getSchedules() {
  return db
    .prepare(`
      SELECT
        s.id,
        s.variant_id,
        v.platform,
        s.scheduled_at,
        s.status,
        s.idempotency_key,
        s.created_at,
        s.published_at
      FROM schedule_slots s
      JOIN variants v
        ON v.id = s.variant_id
      ORDER BY s.scheduled_at
    `)
    .all()
    .map((row) => ({
      ...row
    }));
}

function createSchedule({
  variantId,
  scheduledAt
}) {
  const variant =
    getVariantById(variantId);

  if (!variant) {
    return {
      ok: false,
      status: 404,
      error: "Variant not found"
    };
  }

  if (
    variant.status !== "approved"
  ) {
    return {
      ok: false,
      status: 409,
      error:
        `Only approved variants can be scheduled; current status is ${variant.status}`
    };
  }

  const date =
    new Date(scheduledAt);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return {
      ok: false,
      status: 400,
      error:
        "Invalid scheduled_at: valid date/time is required"
    };
  }

  if (
    date.getTime() <= Date.now()
  ) {
    return {
      ok: false,
      status: 400,
      error:
        "Invalid scheduled_at: scheduled time must be in the future"
    };
  }

  const normalizedTime =
    date.toISOString();

  const idempotencyKey =
    `variant:${variantId}:slot:${normalizedTime}`;

  const existing =
    getScheduleByKey(
      idempotencyKey
    );

  if (existing) {
    return {
      ok: true,
      reused: true,
      schedule: existing
    };
  }

  const createdAt =
    new Date().toISOString();

  const result = db
    .prepare(`
      INSERT INTO schedule_slots (
        variant_id,
        scheduled_at,
        status,
        idempotency_key,
        created_at,
        published_at
      )
      VALUES (?, ?, ?, ?, ?, ?)
    `)
    .run(
      variantId,
      normalizedTime,
      "scheduled",
      idempotencyKey,
      createdAt,
      null
    );

  return {
    ok: true,
    reused: false,
    schedule:
      getScheduleById(
        Number(
          result.lastInsertRowid
        )
      )
  };
}

module.exports = {
  createSchedule,
  getScheduleById,
  getSchedules
};