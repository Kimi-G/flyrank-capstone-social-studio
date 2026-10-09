const crypto =
  require("crypto");

const SocialPublisher =
  require("./socialPublisher");

const db =
  require("../db/db");

class MockXPublisher
  extends SocialPublisher {

  async publish({
    content,
    idempotencyKey
  }) {
    const existing = db
  .prepare(`
    SELECT
      adapter,
      external_id,
      external_url
    FROM mock_publications
    WHERE idempotency_key = ?
  `)
  .get(idempotencyKey);

    if (existing) {
      return {
        externalId:
          existing.external_id,
        externalUrl:
          existing.external_url,
        duplicate: true
      };
    }

    const externalId =
      `mock-x-${crypto.randomUUID()}`;

    const externalUrl =
      `mock://x/${externalId}`;

    db.prepare(`
      INSERT INTO mock_publications (
        idempotency_key,
        adapter,
        content,
        external_id,
        external_url,
        created_at
      )
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      idempotencyKey,
      "mock_x",
      content,
      externalId,
      externalUrl,
      new Date().toISOString()
    );

    return {
      externalId,
      externalUrl,
      duplicate: false
    };
  }
}

module.exports =
  MockXPublisher;