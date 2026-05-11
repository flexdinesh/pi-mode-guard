---
title: Typed tool guard narrowing
description: Use Pi tool-call narrowing for guarded built-in tool inputs.
date: 2026-05-11
slug: typed-tool-guards
status: implemented
tags:
  - pi-extension
  - type-safety
related_paths:
  - .ai/spec/03-typed-tool-guards.md
  - index.ts
---

## Why

Pi docs recommend `isToolCallEventType()` for built-in tool input access. Raw tool input handling is more brittle.

## What

Guard hook now narrows `bash`, `read`, `grep`, `find`, and `ls` before extracting guarded input fields.

## How

Kept generic guard evaluation centralized. Used narrowed input to build minimal guard input objects without type assertions.

## Tradeoffs

The guard helper still accepts generic records because it supports multiple tool families.
