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

---

## Phase 5 — Durable Scheduling, Recovery, and Final Hardening

### Goal

Phase 5 focused on making scheduled publishing survive process and infrastructure interruptions while preserving the core guarantee:

```text
one approved variant + one schedule slot = one publication
```

The main additions were:

- Docker-based Redis
- BullMQ delayed jobs
- publishing worker
- SQLite-to-BullMQ schedule reconciliation
- worker retry handling
- crash recovery
- publish-history hardening
- one-command application startup
- reproducible seed data
- final README and evidence documentation

### AI assistance

AI was used as a development assistant for:

- selecting BullMQ + Redis for the JavaScript scheduling lane
- Docker and WSL setup guidance
- Redis connection setup
- BullMQ queue structure
- deterministic BullMQ job IDs
- worker implementation
- schedule reconciliation design
- crash-recovery reasoning
- test planning
- identifying retry edge cases
- README organization
- EVIDENCE.md organization

All generated suggestions were reviewed and tested locally before being accepted.

### Docker and Redis setup

The initial machine did not have a working Docker CLI.

WSL 2 and Ubuntu were installed, followed by Docker Desktop using its WSL 2 backend.

Docker Desktop installed the CLI under the user's local application directory, but Git Bash did not initially include that directory in `PATH`.

The Git Bash path was corrected before continuing.

Docker functionality was verified with:

```bash
docker run --rm hello-world
```

which returned:

```text
Hello from Docker!
```

Redis was then added through `compose.yaml` with append-only persistence and a Docker volume.

Redis connectivity was verified through both:

```bash
docker exec social-studio-redis redis-cli ping
```

and:

```bash
npm run redis:test
```

Redis persistence was also verified by saving a value, restarting the container, and confirming that the value remained available.

### BullMQ queue

A BullMQ publish queue was added using Redis.

Jobs use a deterministic ID:

```text
schedule-<schedule_id>
```

AI suggested this because a deterministic queue identifier complements the existing SQLite schedule idempotency key.

The queue test confirmed that attempting to enqueue the same schedule more than once returns the same job ID instead of creating multiple publishing jobs.

### First scheduling integration issue

The first scheduling integration added BullMQ enqueueing directly after the SQLite schedule was created.

That worked during normal operation, but the design had a reliability gap:

```text
SQLite schedule saved
→ Redis unavailable
→ BullMQ job not created
```

In that scenario, the schedule would remain stored but could be missed by the worker.

The implementation was therefore improved by adding startup reconciliation.

The worker now reads recoverable SQLite schedules with status:

```text
scheduled
processing
```

and restores their BullMQ jobs using deterministic job IDs.

This made SQLite the application source of truth while BullMQ/Redis remains the execution mechanism.

### Automatic scheduled publishing

The first complete scheduler test used a real Mastodon variant.

The variant was:

```text
variant 11
platform: mastodon
```

It was approved, scheduled through the API, and placed into BullMQ.

No manual publish endpoint was used.

The worker automatically produced:

```text
[worker] Processing job schedule-5 for schedule 5
[worker] Published schedule 5
[worker] Job schedule-5 completed
```

Database verification showed:

```text
schedule 5 → published
variant 11 → published
attempt 1 → success
adapter → mastodon
```

The stored external URL was opened manually and the real Mastodon status was confirmed to exist.

### Retry handling issue found during review

The original Phase 4 publishing service returned an object such as:

```javascript
{
  ok: false,
  status: 502
}
```

when a publisher failed.

AI identified that BullMQ treats a worker function as successful if it returns normally, even when the returned object contains `ok: false`.

That meant the queue's configured retry count would not actually be used for those failures.

The worker was corrected to throw when `publishSchedule()` returns a failed result.

This allows BullMQ to apply its configured attempts and backoff behavior.

### Interrupted publish-history issue

Another edge case was identified around a worker crash.

The dangerous window is:

```text
publish attempt recorded as started
→ external side effect occurs
→ worker crashes
→ local success transaction never commits
```

Without recovery handling, the old attempt could remain:

```text
started
```

forever.

The publishing service was changed so that when a `processing` schedule is recovered, unfinished `started` attempts are closed as:

```text
failed
error: Worker interrupted before attempt completed
```

before a new attempt is created.

This keeps publish history understandable and ensures every attempt has a final result.

### Duplicate recovery result correction

The original implementation classified any adapter response with:

```text
duplicate: true
```

as:

```text
duplicate_skipped
```

That was correct for a retry after a schedule had already been finalized as published.

It was not correct for crash recovery.

If the external side effect succeeded before a crash and the local schedule remained unfinished, the next attempt might discover the existing publication through the same idempotency key.

In that case, the retry is the attempt that successfully finalizes the schedule locally.

The logic was changed so that an unfinished schedule recovered from an existing external publication records:

```text
success
```

while exposing:

```text
reused: true
```

A later call after the schedule is already `published` continues to record:

```text
duplicate_skipped
```

This preserves the requirement that one variant and slot has exactly one successful finalization.

### Controlled crash test

A test-only fault-injection hook was added:

```text
SIMULATE_CRASH_AFTER_PUBLISH=true
```

The hook is restricted to adapters whose names begin with:

```text
mock_
```

This prevents intentional fault injection immediately after a real Mastodon publication.

The test used X variant 9 through `mock_x`.

The first worker created the external mock publication and intentionally exited before committing local success.

Crash state:

```text
schedule 6 → processing
attempt 1 → started
mock publication count → 1
```

The worker was then restarted normally.

Startup reconciliation found the interrupted schedule:

```text
[worker] Reconciliation complete: 1 recoverable schedule(s), 1 queued
```

BullMQ detected the interrupted job:

```text
[worker] Job schedule-6 stalled
```

and safely processed it again.

Final state:

```text
attempt 1 → failed
attempt 2 → success

schedule 6 → published
variant 9 → published

mock publication count → 1
```

Result:

```text
2 publish attempts
1 successful finalization
1 actual publication
0 duplicate posts
```

This was the main Phase 5 durability proof.

### One-command startup

The project initially required separate commands for Redis, the Express API, and the BullMQ worker.

For final reproducibility, `concurrently` was added and the main start command was changed to:

```bash
npm start
```

This now starts:

```text
Redis
Express API
BullMQ worker
```

through one command.

The startup was tested successfully.

### Seed script

The capstone requires a reproducible sample-data step.

A new script was added:

```bash
npm run seed
```

Instead of inserting sample rows directly into SQLite, the seed script calls the application's public API.

This means it exercises the real ingestion and variant-generation path.

A verified seed run created:

```text
post 5

variant 12 → x
variant 13 → linkedin
variant 14 → mastodon
```

and completed with:

```text
SEED COMPLETE
```

### README hardening

The original README still described the project as:

```text
Phase 1 — Design
```

even though the implementation had reached Phase 5.

It was replaced with final operational documentation covering:

- project purpose
- features
- architecture diagram
- reliability flow
- technology stack
- project structure
- prerequisites
- installation
- environment variables
- one-command startup
- seed step
- API workflow
- approval and scheduling
- real Mastodon publishing
- idempotency
- durable scheduling
- crash recovery
- adapter swapping
- tests
- acceptance probes
- security
- known limitations

The documented run path was then verified locally with:

```bash
npm start
```

followed from another terminal by:

```bash
npm run seed
```

Both passed.

### What AI got wrong or incomplete

AI assistance was useful, but several suggestions required correction or expansion during testing.

1. The first queue integration handled normal scheduling but did not fully protect against the gap between saving a SQLite schedule and adding the Redis job. Startup reconciliation was added to close that gap.

2. The initial retry path did not account for BullMQ treating `{ ok: false }` as a successful worker return. The worker was changed to throw failed publish results so BullMQ retries actually occur.

3. The first publish-attempt model could leave an interrupted attempt permanently marked `started`. Recovery now closes interrupted attempts as `failed`.

4. Treating every publisher-side duplicate as `duplicate_skipped` would produce no successful local finalization after some crash scenarios. Recovery now records the finalizing attempt as `success` while preserving `reused: true`.

5. The initial README was only a Phase 1 placeholder and did not represent the completed application. It was rewritten only after the actual one-command startup and seed workflow had been tested.

6. During setup, Docker was installed successfully but Git Bash could not find the Docker CLI. The local Docker binary path had to be added explicitly to Git Bash's `PATH`.

These corrections were made based on actual runtime behavior rather than accepting generated code without verification.

### Phase 5 result

Phase 5 now demonstrates:

```text
durable Redis-backed scheduling
deterministic BullMQ jobs
automatic real Mastodon publication
startup schedule reconciliation
retry-aware worker behavior
visible publish history
worker-crash recovery
one successful publication per variant/slot
zero duplicate external posts under the tested retry scenario
one-command application startup
reproducible seed data
```

Detailed proof is recorded in `EVIDENCE.md`.