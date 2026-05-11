---
title: System prompt mode reminder
description: Mode reminders are per-turn system prompt additions, not persisted hidden messages.
date: 2026-05-11
slug: system-prompt-reminder
status: implemented
tags:
  - pi-extension
  - system-prompt
related_paths:
  - .ai/spec/02-system-prompt-reminder.md
  - index.ts
  - modes.ts
---

## Why

Hidden `before_agent_start` messages persist in session and LLM context. Mode reminders are runtime policy and should not bloat history.

## What

Conversation and Plan reminders now append to `event.systemPrompt`. Build still has no reminder.

## How

Added `applyModeSystemReminder()` and used it from `before_agent_start`. Tests verify no reminder for Build.

## Tradeoffs

Reminder is not stored as auditable session content. Later extensions can still modify the final system prompt.
