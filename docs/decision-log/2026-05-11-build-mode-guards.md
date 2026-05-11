---
title: Build mode guard defaults
description: Build mode keeps tools unlocked but confirms destructive bash and external path access.
date: 2026-05-11
slug: build-mode-guards
status: implemented
tags:
  - pi-extension
  - safety
related_paths:
  - .ai/spec/04-build-mode-guards.md
  - index.ts
  - modes.ts
  - README.md
---

## Why

Build mode previously disabled all guard rules. That made normal implementation easy but removed prompts for high-risk actions.

## What

Build mode now enables `destructive-bash`, `home-path-outside-cwd`, and `absolute-path-outside-cwd`. It still excludes `runtime-binary`.

## How

Moved mode guard rules into `modes.ts`, set Build defaults to the selected 3 rules, and documented the behavior.

## Tradeoffs

Build mode is safer but less frictionless for destructive commands. Runtime commands like `node` and `python` remain unprompted unless another rule matches.

## Rules

Do not add `user_bash` guarding or startup mode flag unless explicitly revisited.
