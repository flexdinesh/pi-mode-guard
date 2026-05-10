---
title: Allow safe /dev/null redirects in mode guard
description: Treat shell redirections to /dev/null as safe without globally whitelisting /dev/null.
date: 2026-05-10
slug: null-redirects
status: implemented
tags:
  - mode-guard
  - bash
  - guards
related_paths:
  - guards.ts
  - guards.test.ts
  - README.md
---

## Why

Mode guard was blocking read-only inspection commands such as `kubectl ... 2>/dev/null` in Conversation and Plan modes. The false positive came from treating `>` as a destructive redirect and `/dev/null` as an absolute path outside the current working directory.

## What

Safe shell redirections to `/dev/null` should not trigger `destructive-bash` or bash path guard findings. The exemption applies only to redirect syntax and only to `/dev/null`.

Normal path references such as `cat /dev/null` remain guarded by `absolute-path-outside-cwd`, and unsafe redirects such as writing to `/tmp/out` or repo files remain guarded.

## How

Use a bash command sanitizer that removes common `/dev/null` redirect forms before destructive and path guard detection. Supported forms include stdout/stderr redirects, spaced redirects, append redirects, combined stdout/stderr redirects, input redirects, and fd duplication used with null redirects.

## Tradeoffs

This keeps the fix narrow instead of globally allowing `/dev/null`. Regex-based shell parsing remains approximate, but the targeted cases are common and covered by regression tests.
