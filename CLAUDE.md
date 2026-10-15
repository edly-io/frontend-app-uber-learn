# frontend-app-uber-learn

Uber mobile learning MFE — XBlock-based course player built on the Uber Base Design System.

## Quick start

| Task | Skill |
|---|---|
| Visual change, new component, token question | `/uber-design-system` |
| Wiring or understanding an API call | `/uber-learn-api` |

## Operating rules

- All visual values come from `--u-*` tokens in `src/styles/tokens.css` — no hex, no `rgb()`, no hardcoded `px` spacing
- Mobile-first (390×844 WebView) — every interactive target ≥ 44px
- Use `--u-space-N` tokens for all spacing, not literal `px` values
- Figma is the source of truth: `ruYJo9EUuYsyJxacE52B4p`
- All API calls use `getAuthenticatedHttpClient()` — never a custom axios instance
- All TanStack Query keys live in `src/api/queries.ts` (`qk.*`) — never inline arrays
