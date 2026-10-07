# Build Log

## Phase 1 — Design

AI was used to review the capstone brief, compare architecture options, and help draft the initial design.

One important design decision was choosing Mastodon as the real publishing target because its posting API supports an idempotency key. I reviewed this choice against the capstone requirement that retries must not create duplicate posts.

No application implementation has been generated yet. The design will be revised if later testing shows that any assumption is incorrect.