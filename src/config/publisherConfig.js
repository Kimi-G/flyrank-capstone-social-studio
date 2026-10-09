function getPublisherAdapter(platform) {
  const mappings = {
    x:
      process.env.PUBLISHER_ADAPTER_X ||
      "mock_x",

    linkedin:
      process.env.PUBLISHER_ADAPTER_LINKEDIN ||
      "mock_linkedin",

    mastodon:
      process.env.PUBLISHER_ADAPTER_MASTODON ||
      "mastodon"
  };

  const adapter =
    mappings[platform];

  if (!adapter) {
    throw new Error(
      `No publisher adapter configured for platform: ${platform}`
    );
  }

  return adapter;
}

module.exports = {
  getPublisherAdapter
};