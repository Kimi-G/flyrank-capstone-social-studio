const db = require("../src/db/db");

const tables = db
  .prepare(`
    SELECT name
    FROM sqlite_master
    WHERE type = 'table'
      AND name IN ('posts', 'variants')
    ORDER BY name
  `)
  .all();

console.log(
  JSON.stringify(
    tables.map((row) => row.name),
    null,
    2
  )
);

db.close();