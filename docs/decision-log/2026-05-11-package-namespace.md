---
title: Package namespace migration
description: Use latest Pi package namespace for extension imports and peers.
date: 2026-05-11
slug: package-namespace
status: implemented
tags:
  - pi-extension
  - packaging
related_paths:
  - .ai/spec/01-package-namespace.md
  - index.ts
  - package.json
  - README.md
---

## Why

Latest Pi docs use `@earendil-works/*`. Old `@mariozechner/*` imports risk failing on current Pi installs.

## What

Migrated extension imports and peer dependencies to `@earendil-works/pi-coding-agent` and `@earendil-works/pi-tui`.

## How

Updated package metadata and README refs. No backward-compatible old namespace shim.

## Tradeoffs

Users pinned to old Pi package names may need to upgrade Pi.
