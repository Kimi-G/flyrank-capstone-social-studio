const {
  editVariant,
  approveVariant,
  rejectVariant
} = require("../services/review.service");

function parseVariantId(req, res) {
  const id =
    Number(req.params.id);

  if (
    !Number.isInteger(id) ||
    id <= 0
  ) {
    res.status(404).json({
      error: "Variant not found"
    });

    return null;
  }

  return id;
}

function edit(req, res) {
  const id =
    parseVariantId(req, res);

  if (id === null) {
    return;
  }

  const {
    content
  } = req.body;

  if (
    typeof content !== "string" ||
    content.trim().length === 0
  ) {
    return res.status(400).json({
      error:
        "Invalid content: content is required"
    });
  }

  const result =
    editVariant(
      id,
      content.trim()
    );

  if (!result.ok) {
    return res
      .status(result.status)
      .json(result);
  }

  return res
    .status(200)
    .json(result);
}

function approve(req, res) {
  const id =
    parseVariantId(req, res);

  if (id === null) {
    return;
  }

  const result =
    approveVariant(id);

  if (!result.ok) {
    return res
      .status(result.status)
      .json(result);
  }

  return res
    .status(200)
    .json(result);
}

function reject(req, res) {
  const id =
    parseVariantId(req, res);

  if (id === null) {
    return;
  }

  const result =
    rejectVariant(id);

  if (!result.ok) {
    return res
      .status(result.status)
      .json(result);
  }

  return res
    .status(200)
    .json(result);
}

module.exports = {
  edit,
  approve,
  reject
};