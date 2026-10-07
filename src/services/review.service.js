const db = require("../db/db");

const {
  getVariantById
} = require("./variant.service");

const {
  validateVariant
} = require("../validators/variant.validator");

function editVariant(id, content) {
  const variant =
    getVariantById(id);

  if (!variant) {
    return {
      ok: false,
      status: 404,
      error: "Variant not found"
    };
  }

  if (
    variant.status === "rejected" ||
    variant.status === "published"
  ) {
    return {
      ok: false,
      status: 409,
      error:
        `Cannot edit a ${variant.status} variant`
    };
  }

  const validation =
    validateVariant(
      variant.platform,
      content
    );

  if (!validation.valid) {
    return {
      ok: false,
      status: 422,
      error:
        "Edited variant failed constraint validation",
      errors:
        validation.errors
    };
  }

  const now =
    new Date().toISOString();

 const approvalReset =
  variant.status === "approved";

if (approvalReset) {
  db.prepare(`
    DELETE FROM schedule_slots
    WHERE variant_id = ?
      AND status = 'scheduled'
  `).run(id);
}

db.prepare(`
  UPDATE variants
  SET
    content = ?,
    status = 'draft',
    validation_result = ?,
    updated_at = ?
  WHERE id = ?
`).run(
  content.trim(),
  JSON.stringify(validation),
  now,
  id
);

  return {
    ok: true,
    approval_reset: approvalReset,
    variant:
      getVariantById(id)
  };
}

function approveVariant(id) {
  const variant =
    getVariantById(id);

  if (!variant) {
    return {
      ok: false,
      status: 404,
      error: "Variant not found"
    };
  }

  if (variant.status === "approved") {
    return {
      ok: true,
      variant
    };
  }

  if (variant.status !== "draft") {
    return {
      ok: false,
      status: 409,
      error:
        `Cannot approve a ${variant.status} variant`
    };
  }

  const now =
    new Date().toISOString();

  db.prepare(`
    UPDATE variants
    SET
      status = 'approved',
      updated_at = ?
    WHERE id = ?
  `).run(
    now,
    id
  );

  return {
    ok: true,
    variant:
      getVariantById(id)
  };
}

function rejectVariant(id) {
  const variant =
    getVariantById(id);

  if (!variant) {
    return {
      ok: false,
      status: 404,
      error: "Variant not found"
    };
  }

  if (variant.status === "rejected") {
    return {
      ok: true,
      variant
    };
  }

  if (variant.status !== "draft") {
    return {
      ok: false,
      status: 409,
      error:
        `Cannot reject a ${variant.status} variant`
    };
  }

  const now =
    new Date().toISOString();

  db.prepare(`
    UPDATE variants
    SET
      status = 'rejected',
      updated_at = ?
    WHERE id = ?
  `).run(
    now,
    id
  );

  return {
    ok: true,
    variant:
      getVariantById(id)
  };
}

module.exports = {
  editVariant,
  approveVariant,
  rejectVariant
};