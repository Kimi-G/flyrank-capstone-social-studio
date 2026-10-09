# Evidence

This document records proof for each Social Media Studio capstone requirement.

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

The same test deliberately validates this rule-breaking variant:

```text
This is the best ever solution. You won't believe how amazing this is. It changes everything. #Backend #APIs #Development
```

Observed result:

```json
{
  "valid": false,
  "errors": [
    "hashtag rule violated: maximum 2 hashtags, received 3",
    "tone rule violated: maximum 2 sentences, received 4",
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

DATABASE CHECK
{ before: 2, after: 2, unchanged: true }
```

The invalid variant was rejected and the variants table remained unchanged.

---

## 3. Variant Generation

Command:

```bash
curl -i -X POST http://localhost:3000/posts/2/variants
```

Observed result:

```text
HTTP/1.1 201 Created
```

Two different variants were generated from the same stored post:

```text
platform: x
status: draft
validation_result.valid: true
```

and:

```text
platform: linkedin
status: draft
validation_result.valid: true
```

The X-style variant contained:

```text
Why Background Jobs Matter: Why Background Jobs Matter Slow work should not keep API users waiting. #Backend #Tech
```

The LinkedIn-style variant contained:

```text
Why Background Jobs Matter

Why Background Jobs Matter Slow work should not keep API users waiting.

A useful reminder for engineering teams: reliable systems should remain predictable even when work is retried or interrupted.

#SoftwareEngineering #BackendDevelopment #Reliability
```

Stored variants can be retrieved with:

```bash
curl -i http://localhost:3000/posts/2/variants
```

which returned:

```text
HTTP/1.1 200 OK
```

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

and reused the same schedule rather than creating another row.

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

The existing scheduled job was removed:

```json
{
  "schedules": []
}
```

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

This prevents previously approved content from being edited and later published without a new human approval.

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

Observed publish result:

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

This proves that adapter selection is configuration-driven and that changing the destination does not require changing business logic.

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

Both attempts returned the same external ID.

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
endsWithStatusId: true
```

Therefore, two publish attempts produced exactly one external Mastodon post.

---

## 7. Durable Scheduling

Pending — Phase 5.

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

Example idempotent Mastodon history:

```text
attempt 1 → success
attempt 2 → duplicate_skipped
same external ID
same external URL
```

The mock adapter swap was also visible in history:

```text
platform: mastodon
adapter: mock_x
result: success
```
---

## 9. Secrets

`.env` is excluded from Git through `.gitignore`.

`.env.example` contains only safe placeholder values.

---

## 10. README / Reproducibility

Pending — finalized during Phase 5.