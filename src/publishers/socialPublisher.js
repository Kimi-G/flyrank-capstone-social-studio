class SocialPublisher {
  async publish({
    content,
    idempotencyKey
  }) {
    throw new Error(
      "publish() must be implemented by a publisher adapter"
    );
  }
}

module.exports = SocialPublisher;