# Social Media Studio — Design

## Problem

Social Media Studio converts one stored blog post into platform-specific social media variants, allows a human to review each variant, schedules approved variants, and publishes each scheduled variant exactly once through a common publisher interface.

The system must remain safe when requests are retried or a worker stops during publishing. An unapproved variant must never be scheduled or published.

## Initial Scope

The first version supports three target profiles:

| Platform | Publisher | Max Length | Tone Rule | Max Hashtags |
| --- | --- | ---: | --- | ---: |
| Mastodon | Real Mastodon adapter | 450 characters | Informative/conversational; reject aggressive promotional phrases | 3 |
| X-style | Mock adapter | 280 characters | Concise/direct; maximum 2 sentences | 2 |
| LinkedIn-style | Mock adapter | 1,200 characters | Professional; reject configured slang/hype terms | 5 |

These are application constraint profiles. Validation is enforced by code before a variant can enter review.

Tone is represented by deterministic rules rather than trusting a generator. Examples include maximum sentence counts and configured forbidden terms.

## Content Flow

```text
Blog post: URL or Markdown
        |
        v
Ingest and store
        |
        v
Generate platform variants
        |
        v
Constraint validation
        |
        v
Review
draft -> approved / rejected
        |
        v
Schedule approved variant
        |
        v
Durable worker
        |
        v
SocialPublisher
   /        |         \
Mastodon  Mock X   Mock LinkedIn
        |
        v
Publish history