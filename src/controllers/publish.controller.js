const {
  publishSchedule,
  getPublishHistory,
  getMockPublications
} = require(
  "../services/publish.service"
);

async function publish(req, res) {
  const scheduleId =
    Number(req.params.id);

  if (
    !Number.isInteger(
      scheduleId
    ) ||
    scheduleId <= 0
  ) {
    return res
      .status(404)
      .json({
        error:
          "Schedule not found"
      });
  }

  const result =
    await publishSchedule(
      scheduleId
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

function history(req, res) {
  return res
    .status(200)
    .json({
      attempts:
        getPublishHistory()
    });
}

function mockPreview(req, res) {
  return res
    .status(200)
    .json({
      publications:
        getMockPublications()
    });
}

module.exports = {
  publish,
  history,
  mockPreview
};
