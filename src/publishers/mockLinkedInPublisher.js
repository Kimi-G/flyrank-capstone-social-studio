const crypto =
  require("crypto");

const SocialPublisher =
  require("./socialPublisher");

const db =
  require("../db/db");

class MockLinkedInPublisher
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
      `mock-linkedin-${crypto.randomUUID()}`;

    const externalUrl =
      `mock://linkedin/${externalId}`;

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
      "mock_linkedin",
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
  MockLinkedInPublisher;