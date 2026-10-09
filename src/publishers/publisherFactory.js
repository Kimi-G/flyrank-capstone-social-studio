const MockXPublisher =
  require("./mockXPublisher");

const MockLinkedInPublisher =
  require("./mockLinkedInPublisher");

const MastodonPublisher =
  require("./mastodonPublisher");

function createPublisher(
  adapterName
) {
  switch (adapterName) {
    case "mock_x":
      return new MockXPublisher();

    case "mock_linkedin":
      return new MockLinkedInPublisher();

    case "mastodon":
      return new MastodonPublisher();

    default:
      throw new Error(
        `Unsupported publisher adapter: ${adapterName}`
      );
  }
}

module.exports = {
  createPublisher
};