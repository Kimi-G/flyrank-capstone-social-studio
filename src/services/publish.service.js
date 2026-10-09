const db = require("../db/db");

const {
  createPublisher
} = require(
  "../publishers/publisherFactory"
);

const {
  getPublisherAdapter
} = require(
  "../config/publisherConfig"
);

function getScheduleForPublish(id) {
  const row = db
    .prepare(`
      SELECT
        s.id,
        s.variant_id,
        s.scheduled_at,
        s.status AS schedule_status,
        s.idempotency_key,
        s.created_at,
        s.published_at,

        v.platform,
        v.content,
        v.status AS variant_status

      FROM schedule_slots s

      JOIN variants v
        ON v.id = s.variant_id

      WHERE s.id = ?
    `)
    .get(id);

  return row
    ? { ...row }
    : null;
}

function getNextAttemptNumber(
  scheduleId
) {
  const row = db
    .prepare(`
      SELECT
        COALESCE(
          MAX(attempt_number),
          0
        ) + 1 AS next_attempt
      FROM publish_attempts
      WHERE schedule_id = ?
    `)
    .get(scheduleId);

  return row.next_attempt;
}

function getLastCompletedAttempt(
  scheduleId
) {
  const row = db
    .prepare(`
      SELECT
        id,
        schedule_id,
        adapter,
        attempt_number,
        result,
        external_id,
        external_url,
        error,
        started_at,
        finished_at
      FROM publish_attempts
      WHERE schedule_id = ?
        AND result IN (
          'success',
          'duplicate_skipped'
        )
        AND external_id IS NOT NULL
      ORDER BY id DESC
      LIMIT 1
    `)
    .get(scheduleId);

  return row
    ? { ...row }
    : null;
}

function createStartedAttempt({
  scheduleId,
  adapter,
  attemptNumber
}) {
  const startedAt =
    new Date().toISOString();

  const result = db
    .prepare(`
      INSERT INTO publish_attempts (
        schedule_id,
        adapter,
        attempt_number,
        result,
        external_id,
        external_url,
        error,
        started_at,
        finished_at
      )
      VALUES (
        ?, ?, ?, 'started',
        NULL, NULL, NULL, ?, NULL
      )
    `)
    .run(
      scheduleId,
      adapter,
      attemptNumber,
      startedAt
    );

  return Number(
    result.lastInsertRowid
  );
}

function recordDuplicateRetry({
  schedule,
  existingAttempt
}) {
  const attemptNumber =
    getNextAttemptNumber(
      schedule.id
    );

  const now =
    new Date().toISOString();

  db.prepare(`
    INSERT INTO publish_attempts (
      schedule_id,
      adapter,
      attempt_number,
      result,
      external_id,
      external_url,
      error,
      started_at,
      finished_at
    )
    VALUES (
      ?, ?, ?, 'duplicate_skipped',
      ?, ?, NULL, ?, ?
    )
  `).run(
    schedule.id,
    existingAttempt.adapter,
    attemptNumber,
    existingAttempt.external_id,
    existingAttempt.external_url,
    now,
    now
  );

  return {
    ok: true,
    reused: true,
    schedule_id:
      schedule.id,
    adapter:
      existingAttempt.adapter,
    attempt_number:
      attemptNumber,
    result:
      "duplicate_skipped",
    external_id:
      existingAttempt.external_id,
    external_url:
      existingAttempt.external_url
  };
}

async function publishSchedule(
  scheduleId
) {
  const schedule =
    getScheduleForPublish(
      scheduleId
    );

  if (!schedule) {
    return {
      ok: false,
      status: 404,
      error:
        "Schedule not found"
    };
  }

  // A retry after successful publishing
  // is recorded but does not publish again.
  if (
    schedule.schedule_status ===
    "published"
  ) {
    const existingAttempt =
      getLastCompletedAttempt(
        schedule.id
      );

    if (existingAttempt) {
      return recordDuplicateRetry({
        schedule,
        existingAttempt
      });
    }
  }

  if (
    schedule.variant_status !==
    "approved"
  ) {
    return {
      ok: false,
      status: 409,
      error:
        `Only approved variants can be published; current status is ${schedule.variant_status}`
    };
  }

  let adapterName;

  try {
    adapterName =
      getPublisherAdapter(
        schedule.platform
      );
  } catch (error) {
    return {
      ok: false,
      status: 500,
      error: error.message
    };
  }

  const attemptNumber =
    getNextAttemptNumber(
      schedule.id
    );

  const attemptId =
    createStartedAttempt({
      scheduleId:
        schedule.id,
      adapter:
        adapterName,
      attemptNumber
    });

  db.prepare(`
    UPDATE schedule_slots
    SET status = 'processing'
    WHERE id = ?
  `).run(schedule.id);

  try {
    const publisher =
      createPublisher(
        adapterName
      );

    const publication =
      await publisher.publish({
        content:
          schedule.content,

        idempotencyKey:
          schedule.idempotency_key
      });

    const attemptResult =
      publication.duplicate
        ? "duplicate_skipped"
        : "success";

    const finishedAt =
      new Date().toISOString();

    db.exec("BEGIN");

    try {
      db.prepare(`
        UPDATE publish_attempts
        SET
          result = ?,
          external_id = ?,
          external_url = ?,
          error = NULL,
          finished_at = ?
        WHERE id = ?
      `).run(
        attemptResult,
        publication.externalId,
        publication.externalUrl,
        finishedAt,
        attemptId
      );

      db.prepare(`
        UPDATE schedule_slots
        SET
          status = 'published',
          published_at = ?
        WHERE id = ?
      `).run(
        finishedAt,
        schedule.id
      );

      db.prepare(`
        UPDATE variants
        SET
          status = 'published',
          updated_at = ?
        WHERE id = ?
      `).run(
        finishedAt,
        schedule.variant_id
      );

      db.exec("COMMIT");
    } catch (error) {
      db.exec("ROLLBACK");
      throw error;
    }

    return {
      ok: true,
      reused:
        publication.duplicate,
      schedule_id:
        schedule.id,
      adapter:
        adapterName,
      attempt_number:
        attemptNumber,
      result:
        attemptResult,
      external_id:
        publication.externalId,
      external_url:
        publication.externalUrl
    };
  } catch (error) {
    const finishedAt =
      new Date().toISOString();

    db.prepare(`
      UPDATE publish_attempts
      SET
        result = 'failed',
        error = ?,
        finished_at = ?
      WHERE id = ?
    `).run(
      error.message,
      finishedAt,
      attemptId
    );

    db.prepare(`
      UPDATE schedule_slots
      SET status = 'failed'
      WHERE id = ?
    `).run(schedule.id);

    return {
      ok: false,
      status: 502,
      error: "Publish failed",
      details:
        error.message
    };
  }
}

function getPublishHistory() {
  return db
    .prepare(`
      SELECT
        pa.id,
        pa.schedule_id,
        s.variant_id,
        v.platform,
        pa.adapter,
        pa.attempt_number,
        pa.result,
        pa.external_id,
        pa.external_url,
        pa.error,
        pa.started_at,
        pa.finished_at

      FROM publish_attempts pa

      JOIN schedule_slots s
        ON s.id =
           pa.schedule_id

      JOIN variants v
        ON v.id =
           s.variant_id

      ORDER BY pa.id DESC
    `)
    .all()
    .map((row) => ({
      ...row
    }));
}

function getMockPublications() {
  return db
    .prepare(`
      SELECT
        id,
        idempotency_key,
        adapter,
        content,
        external_id,
        external_url,
        created_at
      FROM mock_publications
      ORDER BY id DESC
    `)
    .all()
    .map((row) => ({
      ...row
    }));
}

module.exports = {
  publishSchedule,
  getPublishHistory,
  getMockPublications
};