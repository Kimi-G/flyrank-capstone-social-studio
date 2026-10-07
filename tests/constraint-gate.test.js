const db = require("../src/db/db");

const {
  validateVariant
} = require(
  "../src/validators/variant.validator"
);

const badVariant =
  "This is the best ever solution. You won't believe how amazing this is. It changes everything. #Backend #APIs #Development";

const before = db
  .prepare(`
    SELECT COUNT(*) AS count
    FROM variants
  `)
  .get();

const validation =
  validateVariant(
    "x",
    badVariant
  );

console.log("VALIDATION RESULT");

console.log(
  JSON.stringify(
    validation,
    null,
    2
  )
);

if (!validation.valid) {
  console.log(
    "\nBLOCKED BEFORE STORAGE"
  );

  console.log(
    "Broken rules:",
    validation.errors
  );
}

const after = db
  .prepare(`
    SELECT COUNT(*) AS count
    FROM variants
  `)
  .get();

console.log(
  "\nDATABASE CHECK"
);

console.log({
  before: before.count,
  after: after.count,
  unchanged:
    before.count === after.count
});

db.close();