const db =
  require("../src/db/db");

const {
  createPublisher
} = require(
  "../src/publishers/publisherFactory"
);

async function run() {
  db.prepare(`
    DELETE FROM mock_publications
    WHERE idempotency_key LIKE 'adapter-test:%'
  `).run();

  const content =
    "Adapter architecture test";

  const key =
    "adapter-test:variant-1:slot-1";

  console.log(
    "MOCK X FIRST PUBLISH"
  );

  const xPublisher =
    createPublisher("mock_x");

  const first =
    await xPublisher.publish({
      content,
      idempotencyKey: key
    });

  console.log(first);

  console.log(
    "\nMOCK X RETRY"
  );

  const retry =
    await xPublisher.publish({
      content,
      idempotencyKey: key
    });

  console.log(retry);

  const xCount = db
    .prepare(`
      SELECT COUNT(*) AS count
      FROM mock_publications
      WHERE idempotency_key = ?
    `)
    .get(key);

  console.log(
    "\nMOCK X DATABASE COUNT"
  );

  console.log(xCount);

  const linkedInKey =
    "adapter-test:variant-2:slot-1";

  console.log(
    "\nMOCK LINKEDIN PUBLISH"
  );

  const linkedInPublisher =
    createPublisher(
      "mock_linkedin"
    );

  const linkedInResult =
    await linkedInPublisher.publish({
      content:
        "The same business call works through another adapter.",
      idempotencyKey:
        linkedInKey
    });

  console.log(
    linkedInResult
  );

  const rows = db
    .prepare(`
      SELECT
        adapter,
        idempotency_key,
        external_id
      FROM mock_publications
      WHERE idempotency_key LIKE 'adapter-test:%'
      ORDER BY id
    `)
    .all();

  console.log(
    "\nRECORDED MOCK PUBLICATIONS"
  );

  console.log(rows);

  db.close();
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});