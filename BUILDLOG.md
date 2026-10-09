# Build Log

## Phase 1 — Design

AI was used to review the capstone brief, compare architecture options, and help draft the initial design.

One important design decision was choosing Mastodon as the real publishing target because its posting API supports an idempotency key. I reviewed this choice against the capstone requirement that retries must not create duplicate posts.

No application implementation has been generated yet. The design will be revised if later testing shows that any assumption is incorrect.

## Phase 2 — Ingestion, Generation, and Constraint Enforcement

AI was used to help structure the Express application, draft the SQLite access layer, design the URL ingestion service, define deterministic platform constraint profiles, and create test commands.

During implementation, one controller refactor was initially inconsistent: the old `createMarkdownPost` function remained while the route expected `createPost`, and the service function had been aliased to `savePost`. This caused Express and SQLite errors. I reviewed the stack traces, corrected the controller export and service call, and retested Markdown ingestion before continuing.

Markdown ingestion was verified with a successful `201 Created` response and retrieval from SQLite.

URL ingestion was then added using Node's built-in `fetch()` and Cheerio. A URL from `https://example.com` was successfully fetched, converted to stored content, and retrieved from SQLite. Unsupported protocols such as `ftp://` were rejected with a `400` response.

Variant generation was implemented using deterministic templates for X-style and LinkedIn-style posts. Generation loads the source post from SQLite using its post ID instead of accepting the source content again from the client.

Constraint enforcement is implemented in application code. The validator checks maximum length, hashtag count, sentence-based tone rules, and forbidden terms.

A deliberate invalid X-style variant was rejected for multiple named violations. A database count before and after the validation test confirmed that the invalid variant was blocked before storage.

AI-generated suggestions were not accepted blindly. Errors were corrected using runtime output, direct SQLite queries, and repeated API tests.

## Phase 3 — Review Workflow

AI was used to help structure the review service, review endpoints, scheduling gate, and edge-case tests.

The review workflow now supports editing, approving, and rejecting variants. Edited content is validated again before being saved.

Only variants with `approved` status can be scheduled. A rejected variant was tested and returned `409 Conflict`, while an approved variant successfully created a schedule.

Scheduling also creates a deterministic idempotency key based on the variant and scheduled time. Repeating the same scheduling request reused the existing schedule instead of creating a duplicate.

During review of the workflow, I identified an additional safety issue: an approved variant could already have a schedule and then be edited. Without extra handling, the modified text could eventually be published even though the edit had never been approved.

The implementation was changed so editing an approved variant resets it to `draft` and removes any pending scheduled job for that variant. Testing confirmed that the existing schedule disappeared and the edited draft could not be scheduled again until it was reapproved.

## Phase 4 — Publisher Adapters and Idempotent Publishing

AI was used to help design the publisher adapter interface, mock adapters, publisher factory, publish service, Mastodon adapter, publish history, and idempotency tests.

The application now has one common `SocialPublisher` interface with `MockXPublisher`, `MockLinkedInPublisher`, and a real `MastodonPublisher`.

The mock adapters were tested first. Repeating the same mock publish returned the same external identifier and created only one mock publication.

A shared publish service was then added. It records every publish attempt while protecting the external side effect from duplication.

Mastodon authentication was configured using a token stored only in the local `.env`. An initial authentication test failed because `MASTODON_BASE_URL` still contained a placeholder value. After changing it to `https://mastodon.social`, authentication succeeded.

The real Mastodon adapter was added without changing the shared publishing business logic. A validated Mastodon variant was approved, scheduled, and successfully published to the real account. The returned live status URL was opened in a browser and verified.

Repeating the publish request recorded a second attempt as `duplicate_skipped` while preserving the same external status ID and URL.

During variant generation, the sentence validator initially counted trailing hashtags as an additional sentence. The validator was corrected to remove hashtag tokens before sentence counting rather than weakening the platform constraint.

Finally, adapter swapping was tested by temporarily setting `PUBLISHER_ADAPTER_MASTODON=mock_x`. A Mastodon-platform campaign then published through the X mock adapter without any changes to review, scheduling, or publishing business logic.

The implementation was validated using API responses, direct database checks, mock publication counts, publish history, and a real Mastodon status.