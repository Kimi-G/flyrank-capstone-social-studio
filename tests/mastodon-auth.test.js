require("dotenv").config();

async function run() {
  const baseUrl =
    process.env.MASTODON_BASE_URL;

  const token =
    process.env.MASTODON_ACCESS_TOKEN;

  if (!baseUrl) {
    throw new Error(
      "MASTODON_BASE_URL is missing"
    );
  }

  if (!token) {
    throw new Error(
      "MASTODON_ACCESS_TOKEN is missing"
    );
  }

  const normalizedBaseUrl =
    baseUrl.replace(/\/+$/, "");

  const response = await fetch(
    `${normalizedBaseUrl}/api/v1/accounts/verify_credentials`,
    {
      headers: {
        Authorization:
          `Bearer ${token}`,
        Accept:
          "application/json"
      },
      signal:
        AbortSignal.timeout(10000)
    }
  );

  if (!response.ok) {
    const text =
      await response.text();

    throw new Error(
      `Mastodon authentication failed (${response.status}): ${text}`
    );
  }

  const account =
    await response.json();

  console.log(
    "MASTODON AUTHENTICATION OK"
  );

  console.log({
    id: account.id,
    username: account.username,
    acct: account.acct,
    display_name:
      account.display_name,
    url: account.url
  });
}

run().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});