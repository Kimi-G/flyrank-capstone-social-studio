const SocialPublisher =
  require("./socialPublisher");

class MastodonPublisher
  extends SocialPublisher {

  constructor() {
    super();

    this.baseUrl =
      process.env.MASTODON_BASE_URL
        ?.replace(/\/+$/, "");

    this.accessToken =
      process.env.MASTODON_ACCESS_TOKEN;

    this.visibility =
      process.env.MASTODON_VISIBILITY ||
      "unlisted";
  }

  validateConfiguration() {
    if (!this.baseUrl) {
      throw new Error(
        "MASTODON_BASE_URL is not configured"
      );
    }

    if (!this.accessToken) {
      throw new Error(
        "MASTODON_ACCESS_TOKEN is not configured"
      );
    }

    const allowedVisibility = [
      "public",
      "unlisted",
      "private",
      "direct"
    ];

    if (
      !allowedVisibility.includes(
        this.visibility
      )
    ) {
      throw new Error(
        `Invalid Mastodon visibility: ${this.visibility}`
      );
    }
  }

  async publish({
    content,
    idempotencyKey
  }) {
    this.validateConfiguration();

    if (
      typeof content !== "string" ||
      content.trim().length === 0
    ) {
      throw new Error(
        "Mastodon content is required"
      );
    }

    if (
      typeof idempotencyKey !==
        "string" ||
      idempotencyKey.trim().length === 0
    ) {
      throw new Error(
        "Mastodon idempotency key is required"
      );
    }

    const body =
      new URLSearchParams();

    body.set(
      "status",
      content.trim()
    );

    body.set(
      "visibility",
      this.visibility
    );

    let response;

    try {
      response = await fetch(
        `${this.baseUrl}/api/v1/statuses`,
        {
          method: "POST",

          headers: {
            Authorization:
              `Bearer ${this.accessToken}`,

            "Content-Type":
              "application/x-www-form-urlencoded",

            Accept:
              "application/json",

            "Idempotency-Key":
              idempotencyKey
          },

          body,

          signal:
            AbortSignal.timeout(
              15000
            )
        }
      );
    } catch (error) {
      throw new Error(
        `Mastodon request failed: ${error.message}`
      );
    }

    if (!response.ok) {
      let errorMessage =
        `HTTP ${response.status}`;

      try {
        const errorBody =
          await response.json();

        if (errorBody.error) {
          errorMessage =
            errorBody.error;
        }
      } catch {
        // Keep HTTP status message.
      }

      throw new Error(
        `Mastodon publish failed (${response.status}): ${errorMessage}`
      );
    }

    const status =
      await response.json();

    if (!status.id) {
      throw new Error(
        "Mastodon response did not contain a status ID"
      );
    }

    return {
      externalId:
        String(status.id),

      externalUrl:
        status.url ||
        status.uri ||
        null,

      duplicate: false
    };
  }
}

module.exports =
  MastodonPublisher;