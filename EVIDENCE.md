# Evidence

This document records proof for each Social Media Studio capstone requirement.

---

## 1. Post Ingestion

### Markdown ingestion

Command:

```bash
curl -i -X POST http://localhost:3000/posts \
-H "Content-Type: application/json" \
-d '{"source_type":"markdown","title":"Why Background Jobs Matter","content":"# Why Background Jobs Matter\n\nSlow work should not keep API users waiting."}'
```

Observed result:

```text
HTTP/1.1 201 Created
```

```json
{
  "id": 2,
  "source_type": "markdown",
  "source_url": null,
  "title": "Why Background Jobs Matter",
  "content": "# Why Background Jobs Matter\n\nSlow work should not keep API users waiting."
}
```

The stored post was retrieved successfully with:

```bash
curl -i http://localhost:3000/posts/2
```

and returned:

```text
HTTP/1.1 200 OK
```

### URL ingestion

Command:

```bash
curl -i -X POST http://localhost:3000/posts \
-H "Content-Type: application/json" \
-d '{"source_type":"url","source_url":"https://example.com"}'
```

Observed result:

```text
HTTP/1.1 201 Created
```

```json
{
  "id": 3,
  "source_type": "url",
  "source_url": "https://example.com/",
  "title": "Example Domain",
  "content": "This domain is for use in documentation examples without needing permission. This is not a service; avoid relying on it for testing and monitoring purposes."
}
```

Retrieving the stored record:

```bash
curl -i http://localhost:3000/posts/3
```

returned:

```text
HTTP/1.1 200 OK
```

Invalid URL protocols are rejected:

```bash
curl -i -X POST http://localhost:3000/posts \
-H "Content-Type: application/json" \
-d '{"source_type":"url","source_url":"ftp://example.com/article"}'
```

Result:

```text
HTTP/1.1 400 Bad Request
```

```json
{
  "error": "Invalid source_url: only http and https URLs are allowed"
}
```

Generation receives only the stored post ID and loads the source post from SQLite. The client does not resend the source content during variant generation.

---

## 2. Constraint Profiles

The application currently defines constraint profiles for:

- X-style
- LinkedIn-style
- Mastodon

Constraints include:

- maximum character length
- maximum hashtag count
- deterministic tone rules
- forbidden promotional terms
- maximum sentence count where applicable

Validation is performed in application code before a generated variant is stored.

### Valid variant proof

Command:

```bash
npm run variant:test
```

Observed valid X-style result:

```json
{
  "valid": true,
  "errors": [],
  "metrics": {
    "characters": 84,
    "hashtags": 2
  }
}
```

### Invalid variant proof

The test deliberately validates this rule-breaking variant:

```text
This is the best ever solution. You won't believe how amazing this is. It changes everything. #Backend #APIs #Development
```

Observed result:

```json
{
  "valid": false,
  "errors": [
    "hashtag rule violated: maximum 2 hashtags, received 3",
    "tone rule violated: maximum 2 sentences, received 3",
    "tone rule violated: forbidden term \"best ever\"",
    "tone rule violated: forbidden term \"you won't believe\""
  ],
  "metrics": {
    "characters": 121,
    "hashtags": 3
  }
}
```

### Proof that invalid content is blocked before storage

Command:

```bash
npm run constraint:test
```

Observed result:

```text
BLOCKED BEFORE STORAGE

Broken rules:
- hashtag rule violated: maximum 2 hashtags, received 3
- tone rule violated: maximum 2 sentences, received 3
- tone rule violated: forbidden term "best ever"
- tone rule violated: forbidden term "you won't believe"

DATABASE CHECK
{ before: 14, after: 14, unchanged: true }
```

The invalid variant was rejected before storage and the variants table remained unchanged.

---

## 3. Variant Generation

Variant generation reads a stored post and creates platform-specific variants.

Command:

```bash
curl -i -X POST http://localhost:3000/posts/4/variants
```

The current configuration generates variants for:

```text
x
linkedin
mastodon
```

A verified generation run created:

```text
variant 9  → x        → draft
variant 10 → linkedin → draft
variant 11 → mastodon → draft
```

Each generated variant passed its platform constraint profile before being stored.

Stored variants can be retrieved through the post variants endpoint.

A request for variants from a nonexistent post:

```bash
curl -i -X POST http://localhost:3000/posts/99999/variants
```

returned:

```text
HTTP/1.1 404 Not Found
```

```json
{
  "ok": false,
  "status": 404,
  "error": "Post not found"
}
```

This demonstrates that generation uses stored source records and refuses nonexistent post IDs.

---

## 4. Review Workflow

Variants support editing, approval, and rejection.

### Editing a draft variant

Command:

```bash
curl -i -X PATCH http://localhost:3000/variants/1 \
-H "Content-Type: application/json" \
-d '{"content":"Background jobs keep APIs responsive while workers handle slow tasks safely. #Backend #Reliability"}'
```

Observed result:

```text
HTTP/1.1 200 OK
```

The edited variant remained:

```text
status: draft
validation_result.valid: true
```

Edited content is revalidated against the platform constraint profile before it is accepted.

### Approval

Command:

```bash
curl -i -X POST http://localhost:3000/variants/1/approve
```

Observed result:

```text
HTTP/1.1 200 OK
status: approved
```

### Rejection

Command:

```bash
curl -i -X POST http://localhost:3000/variants/2/reject
```

Observed result:

```text
HTTP/1.1 200 OK
status: rejected
```

### Unapproved variants cannot be scheduled

Variant 2 was rejected and then used in a scheduling attempt:

```bash
curl -i -X POST http://localhost:3000/variants/2/schedule \
-H "Content-Type: application/json" \
-d '{"scheduled_at":"2026-12-01T18:00:00.000Z"}'
```

Observed result:

```text
HTTP/1.1 409 Conflict
```

```json
{
  "ok": false,
  "status": 409,
  "error": "Only approved variants can be scheduled; current status is rejected"
}
```

### Approved variants can be scheduled

Variant 1 was approved and scheduled:

```bash
curl -i -X POST http://localhost:3000/variants/1/schedule \
-H "Content-Type: application/json" \
-d '{"scheduled_at":"2026-12-01T18:00:00.000Z"}'
```

Observed result:

```text
HTTP/1.1 201 Created
```

The schedule contained a deterministic idempotency key:

```text
variant:1:slot:2026-12-01T18:00:00.000Z
```

Repeating the identical scheduling request returned:

```text
HTTP/1.1 200 OK
reused: true
```

and reused the same schedule rather than creating another schedule row.

### Editing approved content invalidates approval

An approved and scheduled variant was edited.

Observed response:

```json
{
  "ok": true,
  "approval_reset": true
}
```

The variant status returned to:

```text
draft
```

The pending SQLite schedule was removed.

Attempting to schedule the edited variant without approving it again returned:

```text
HTTP/1.1 409 Conflict
```

```json
{
  "ok": false,
  "status": 409,
  "error": "Only approved variants can be scheduled; current status is draft"
}
```

This prevents edited content from being published under an earlier approval.

---

## 5. Adapter Layer

Publishing uses one common `SocialPublisher` interface.

Implemented adapters:

- `MastodonPublisher` — real Mastodon publishing
- `MockXPublisher` — local mock publisher
- `MockLinkedInPublisher` — local mock publisher

All adapters implement the same operation:

```javascript
publish({
  content,
  idempotencyKey
})
```

The publishing service depends on the publisher interface/factory rather than platform-specific API code.

### Mock adapter proof

Command:

```bash
npm run publisher:test
```

The first `mock_x` publish returned:

```text
duplicate: false
```

Repeating the same publish returned the same external ID with:

```text
duplicate: true
```

Database count:

```text
count: 1
```

The same publisher interface also successfully invoked `mock_linkedin`.

### Configuration-only adapter swap

The Mastodon platform was temporarily configured to use the X mock adapter:

```bash
PUBLISHER_ADAPTER_MASTODON=mock_x npm start
```

No publishing, scheduling, review, or campaign business logic was changed.

A Mastodon-platform variant was then published.

Observed result:

```text
platform: mastodon
adapter: mock_x
result: success
```

The resulting external URL used the mock publisher:

```text
mock://x/...
```

Publish history also recorded:

```text
platform: mastodon
adapter: mock_x
```

This proves adapter selection is configuration-driven and changing the destination does not require changing business logic.

---

## 6. Idempotent Publishing

### Mock publisher retry

A scheduled X-style variant was published twice.

First attempt:

```text
adapter: mock_x
attempt_number: 1
result: success
```

Second attempt:

```text
adapter: mock_x
attempt_number: 2
result: duplicate_skipped
```

Both attempts referenced the same external ID.

Only one matching row existed in `mock_publications`.

### Real Mastodon publishing

A Mastodon variant was generated from a stored post, validated, approved, and scheduled.

The first publish returned:

```text
adapter: mastodon
attempt_number: 1
result: success
```

The response included a real Mastodon status ID and a live `https://mastodon.social/...` status URL.

The live status was opened manually in the browser and confirmed to exist on the owned Mastodon account.

Repeating the exact publish call returned:

```text
adapter: mastodon
attempt_number: 2
result: duplicate_skipped
reused: true
```

Both publish attempts referenced the same Mastodon status ID and the same live status URL.

The URL stored in the database was also checked locally:

```text
hasUrl: true
urlLength: 50
endsWithStatusId: true
```

Therefore, repeated publish attempts produced exactly one external Mastodon post.

---

## 7. Durable Scheduling

Phase 5 uses BullMQ with Redis running in Docker as the durable job store.

SQLite stores application schedule records while BullMQ and Redis provide durable delayed-job execution.

### Redis connection

The Redis container responded successfully:

```bash
docker exec social-studio-redis redis-cli ping
```

Observed result:

```text
PONG
```

The Node application also successfully connected to Redis:

```bash
npm run redis:test
```

Observed result:

```text
REDIS CONNECTION OK
{ ping: 'PONG' }
```

### Redis persistence

Redis persistence was verified by storing a value, restarting the Redis container, and confirming that the value remained available.

```bash
docker exec social-studio-redis redis-cli SET social-studio-test durable
```

Result:

```text
OK
```

Redis was restarted:

```bash
docker restart social-studio-redis
```

The value was then retrieved:

```bash
docker exec social-studio-redis redis-cli GET social-studio-test
```

Result:

```text
durable
```

This proves the Redis job store survives a container restart.

### Deterministic BullMQ job IDs

BullMQ uses a deterministic job ID based on the schedule ID:

```text
schedule-<schedule_id>
```

Queue test:

```bash
npm run queue:test
```

Observed result:

```text
BULLMQ QUEUE OK
{
  firstJobId: 'schedule-999999',
  secondJobId: 'schedule-999999',
  sameJobId: true
}
{
  storedInRedis: true,
  scheduleId: 999999
}
```

Repeated attempts to enqueue the same schedule therefore resolve to the same BullMQ job ID.

### Schedule reconciliation

The worker reconciles SQLite schedules with Redis when it starts.

Command:

```bash
npm run reconcile:test
```

Observed result when no recovery was required:

```text
RECONCILIATION RESULT
{ found: 0, queued: 0 }

QUEUE RECOVERY CHECK
{ recoverableSchedules: 0, missingJobs: [] }

RECONCILIATION OK
```

Recoverable schedule statuses include:

```text
scheduled
processing
```

This allows a worker restart to restore a missing or interrupted BullMQ job from the SQLite source of truth.

### Automatic real Mastodon scheduling

Mastodon variant 11 was approved and scheduled through the scheduling API.

Schedule response:

```text
HTTP/1.1 201 Created
```

```json
{
  "ok": true,
  "reused": false,
  "schedule": {
    "id": 5,
    "variant_id": 11,
    "status": "scheduled"
  },
  "queue": {
    "job_id": "schedule-5",
    "status": "queued"
  }
}
```

The manual publish endpoint was not called.

The BullMQ worker automatically processed the scheduled job:

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
external ID → stored
external URL → stored
```

The stored external URL was opened in the browser and the real Mastodon post was confirmed to exist.

The tested flow was:

```text
approved variant
→ SQLite schedule
→ BullMQ delayed job
→ Redis
→ worker
→ publishSchedule()
→ Mastodon
→ publish history
```

### Worker crash and restart recovery

A controlled fault was used with `mock_x` to simulate the dangerous failure window where the external publishing side effect succeeds but the worker exits before the local success transaction is committed.

The crash simulation was enabled with:

```bash
SIMULATE_CRASH_AFTER_PUBLISH=true npm run worker
```

The worker processed schedule 6 and intentionally terminated after the mock publisher created its publication:

```text
[worker] Processing job schedule-6 for schedule 6
[publish] Simulating worker crash after external publish for schedule 6
```

Immediately after the crash, the database showed:

```text
schedule 6 → processing
attempt 1 → started
mock publications → exactly 1
```

The mock publication had the schedule idempotency key:

```text
variant:9:slot:2026-10-11T02:46:20.953Z
```

The worker was then restarted normally:

```bash
npm run worker
```

Recovery output:

```text
[worker] Reconciliation complete: 1 recoverable schedule(s), 1 queued
[worker] Listening on queue "social-publish"
[worker] Job schedule-6 stalled
[worker] Processing job schedule-6 for schedule 6
[worker] Published schedule 6
[worker] Job schedule-6 completed
```

Final database state:

```text
schedule 6 → published
variant 9 → published
```

Publish attempts:

```text
attempt 1
result → failed
error → Worker interrupted before attempt completed

attempt 2
result → success
```

The successful second attempt reused the same external publication created before the worker crash.

The `mock_publications` table still contained exactly one row for the schedule idempotency key.

Result:

```text
2 publish attempts
1 successful finalization
1 actual publication
0 duplicate posts
```

This demonstrates durable scheduling and idempotent recovery across a worker crash.

---

## 8. Publish History

Every publish attempt is stored in the `publish_attempts` table and exposed through:

```bash
curl http://localhost:3000/publish/history
```

History records include:

- schedule ID
- variant ID
- platform
- adapter
- attempt number
- result
- external ID
- external URL
- error, when present
- start and finish timestamps

### Normal idempotent retry

Example Mastodon history:

```text
attempt 1 → success
attempt 2 → duplicate_skipped
same external ID
same external URL
```

### Worker interruption history

The controlled Phase 5 crash test produced:

```text
attempt 1 → failed
error → Worker interrupted before attempt completed

attempt 2 → success
```

Only one corresponding mock publication existed.

### Adapter swap history

The configuration-only adapter swap was also visible in history:

```text
platform: mastodon
adapter: mock_x
result: success
```

This demonstrates that successful, skipped, failed, and recovered publish attempts remain visible.

---

## 9. Secrets

`.env` is excluded from Git through `.gitignore`.

The real Mastodon access token exists only in `.env`.

`.env.example` contains only safe placeholder values.

The repository was checked to confirm `.env` is not tracked:

```bash
git ls-files .env
```

Observed result:

```text
(no output)
```

No access token is included in `EVIDENCE.md`, `README.md`, or committed source files.

---

## 10. README / Reproducibility

The final README documents:

- what Social Media Studio does
- the complete application architecture
- project structure
- prerequisites
- environment configuration
- exact installation steps
- one main application run command
- sample-data seed command
- API workflow
- scheduling and publishing workflow
- idempotency behavior
- durable scheduling and reconciliation
- worker crash/restart testing
- adapter configuration and swapping
- test commands
- acceptance-probe instructions
- security practices
- known limitations

### One-command application startup

The project was tested with:

```bash
npm start
```

The command starts:

```text
Redis Docker container
Express API
BullMQ publishing worker
```

Observed startup output:

```text
Container social-studio-redis Running

[WORKER] [worker] Reconciliation complete: 0 recoverable schedule(s), 0 queued
[WORKER] [worker] Listening on queue "social-publish"

[API] Social Media Studio API running at http://localhost:3000
```

This verifies that the application services required for normal operation can be started through one command after installation and environment setup.

### Seed step

With the application running, sample data was created using:

```bash
npm run seed
```

Observed output:

```text
Seeding Social Media Studio through http://localhost:3000
Created sample post 5
Generated sample variants

┌─────────┬────┬────────────┬─────────┐
│ (index) │ id │ platform   │ status  │
├─────────┼────┼────────────┼─────────┤
│ 0       │ 12 │ 'x'        │ 'draft' │
│ 1       │ 13 │ 'linkedin' │ 'draft' │
│ 2       │ 14 │ 'mastodon' │ 'draft' │
└─────────┴────┴────────────┴─────────┘

SEED COMPLETE
```

The seed script uses the public API rather than inserting records directly into SQLite. This exercises the normal ingestion and variant-generation path.

### Reproducible setup

The documented setup for a new clone is:

```bash
npm install
cp .env.example .env
```

After required environment values are configured, the application starts with:

```bash
npm start
```

and sample data is created from another terminal with:

```bash
npm run seed
```

Windows-specific `.env` copy instructions are also included in the README.

### Reviewer guidance

The README contains a dedicated Acceptance Probe Guide covering:

```text
Probe 1 → ingest and generate valid variants
Probe 2 → reject a rule-breaking variant
Probe 3 → refuse scheduling of an unapproved variant
Probe 4 → schedule and automatically publish to real Mastodon
Probe 5 → interrupt and recover a worker with zero duplicate publication
Probe 6 → swap publisher adapter through configuration only
```

The README also documents the commands required to inspect publish history and mock publications.

### Known limitations

The README explicitly documents current limitations rather than hiding them, including:

- single-user architecture
- no authentication or multi-tenancy
- deterministic template-based generation
- Mastodon as the only real publisher
- mock X and LinkedIn publishers
- Node `node:sqlite` experimental warning
- seed data accumulating between runs
- controlled crash hook being test-only
- Redis availability requirements
- behavior of a BullMQ job that remains after an approved scheduled variant is edited and its SQLite schedule is invalidated

The completed README therefore provides the architecture, run instructions, seed instructions, testing guidance, acceptance-probe workflow, security guidance, and known limitations required for reproduction and review.