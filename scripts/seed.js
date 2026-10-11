require("dotenv").config();

const port =
  process.env.PORT || 3000;

const API_BASE_URL =
  process.env.API_BASE_URL ||
  `http://localhost:${port}`;

async function readResponse(
  response
) {
  const text =
    await response.text();

  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

async function run() {
  console.log(
    `Seeding Social Media Studio through ${API_BASE_URL}`
  );

  const postResponse =
    await fetch(
      `${API_BASE_URL}/posts`,
      {
        method: "POST",
        headers: {
          "Content-Type":
            "application/json"
        },
        body: JSON.stringify({
          source_type: "markdown",
          title:
            "Reliable Social Publishing",
          content:
            "# Reliable Social Publishing\n\nReliable publishing systems validate platform rules, require human approval, and remain safe when jobs are retried or workers restart."
        })
      }
    );

  const postBody =
    await readResponse(
      postResponse
    );

  if (!postResponse.ok) {
    throw new Error(
      `Post seed failed (${postResponse.status}): ${JSON.stringify(postBody)}`
    );
  }

  const post =
    postBody.post ||
    postBody;

  const postId =
    post.id;

  if (!postId) {
    throw new Error(
      "Seed post response did not contain a post ID"
    );
  }

  console.log(
    `Created sample post ${postId}`
  );

  const variantsResponse =
    await fetch(
      `${API_BASE_URL}/posts/${postId}/variants`,
      {
        method: "POST"
      }
    );

  const variantsBody =
    await readResponse(
      variantsResponse
    );

  if (!variantsResponse.ok) {
    throw new Error(
      `Variant seed failed (${variantsResponse.status}): ${JSON.stringify(variantsBody)}`
    );
  }

  const variants =
    variantsBody.variants ||
    variantsBody;

  console.log(
    "Generated sample variants"
  );

  if (Array.isArray(variants)) {
    console.table(
      variants.map(
        (variant) => ({
          id: variant.id,
          platform:
            variant.platform,
          status:
            variant.status
        })
      )
    );
  } else {
    console.log(
      variantsBody
    );
  }

  console.log(
    "SEED COMPLETE"
  );
}

run().catch((error) => {
  console.error(
    "Seed failed:",
    error.message
  );

  process.exitCode = 1;
});