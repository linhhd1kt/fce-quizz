# Design: [Feature Name]

**Date:** YYYY-MM-DD
**Status:** Draft | Review | Approved

---

## Problem

> What user pain or gap does this solve? One paragraph max.

## Requirements

> Numbered list. Each item is one testable behavior.

1. ...
2. ...
3. ...

## Out of Scope

> Explicitly list what this feature does NOT cover.

- ...

---

## UI Layout

> ASCII mockup or description of the screen(s) affected.

```
[Before]

[After]
```

---

## State Changes

### Add
- `newState: type` — description

### Remove
- `oldState` — reason

### Keep (unchanged)
- `existingState` — note if behavior changes subtly

---

## Data / API Changes

| Endpoint | Method | Change |
|---|---|---|
| `/api/...` | POST | Added `field` param |

> If none: "No API changes."

---

## Logic / Formula

> Any non-trivial calculation, algorithm, or business rule.

```
formula or pseudocode
```

---

## Files Changed

| File | Change |
|---|---|
| `path/to/file.tsx` | Description |

---

## Edge Cases

- What happens when X is empty?
- What happens when Y exceeds limit?
- What happens if Z fails?

---

## E2E Test Scenarios

> Map directly to Requirements above. One scenario per requirement minimum.

| # | Scenario | Requirement |
|---|---|---|
| 1 | User does X → sees Y | Req 1 |
| 2 | User does A → B does not appear | Req 2 |
