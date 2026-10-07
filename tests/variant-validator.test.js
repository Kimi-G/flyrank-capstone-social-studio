const {
  validateVariant
} = require(
  "../src/validators/variant.validator"
);

const validX =
  "Background jobs keep APIs responsive while workers handle slow tasks. #Backend #APIs";

const invalidX =
  "This is the best ever solution. You won't believe how amazing this is. It changes everything. #Backend #APIs #Development";

console.log(
  "VALID X VARIANT"
);

console.log(
  JSON.stringify(
    validateVariant("x", validX),
    null,
    2
  )
);

console.log(
  "\nINVALID X VARIANT"
);

console.log(
  JSON.stringify(
    validateVariant("x", invalidX),
    null,
    2
  )
);