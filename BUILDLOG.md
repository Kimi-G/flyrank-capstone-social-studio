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