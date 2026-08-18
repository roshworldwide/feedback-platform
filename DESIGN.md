# Building on AURUM

The token layer is `src/styles/aurum.css`. Read it before writing any component.
These are the rules that make a build pass review.

## Absolute

1. **Never write a hex, a raw rgb, or a ramp value in a component.** Only semantic
   roles: `var(--surface-*)`, `var(--content-*)`, `var(--stroke-*)`, `var(--fill-*)`,
   `var(--e1..e5)`, `var(--signal-*)`. A component that references `--ti-40`
   directly is broken — it will not respond to a finish change.
2. **One Aurum element per screen.** The metal is the element of consequence. If a
   second is needed, the first was not the most important thing — demote it to
   titanium and re-decide. Never gold on error, warning or destructive states.
3. **Anything a finger touches is a capsule** (`--radius-capsule`, h ≤ 56).
   Anything that holds content is a squircle (`--radius-lg` cards, `--radius-xl`
   sheets/modals, `--radius-sm` chips/code). Nothing is a rectangle.
4. **Concentric radii.** A child inside a rounded parent takes the parent's radius
   *minus the gap*: `r-inner = r-outer - gap`. Never the same radius on both.
5. **Every dimension is 4 × n.** Use `--space-1..16`. Prefer a gap to a divider.
6. **The fourteen type steps are a closed set.** Use `.t-title-1`, `.t-body`,
   `.t-caption` etc. A design needing a fifteenth step is wrong. One step between
   neighbours — skipping two reads as an error.
7. **Tabular numerals on every figure that changes.** Add `tabular` or use a
   `<table>`; a number that reflows its neighbours destroys the instrument.
8. **44pt minimum touch target**, always.
9. **Nothing eases linearly.** Use `--ease-standard|enter|exit|glide|snap` with the
   matching `--dur-*`. Enter : Exit is roughly 2 : 1 — leaving is always faster
   than arriving.
10. **Every surface has empty, loading and error states.** Skeletons draw the
    destination in the final layout; never a spinner where a count exists.

## Elevation

`e0` flush (rim only) · `e1` cards and tiles · `e2` hover and dragged ·
`e3` toolbars, popovers · `e4` sheets, side panels, menus · `e5` the one hero
object per product. Depth order is canvas → grouped → raised → glass → sheet →
alert. Never skip more than two levels.

## Contrast floor

4.5:1 for text, 3:1 for icons and control edges — no exceptions for aesthetics.
On dark, `--content-quaternary` and below are structural only and may never
carry a word a user must read. On light finishes the accent steps two rungs down
the ramp (Aurum 70), because Aurum 50 on white is 2.67:1 and forbidden as text.

## Product rules these components must enforce

- A rating is never rendered without the campaign it belongs to.
- A list never truncates silently — always paginate and state the true total
  ("Showing 1–25 of 160").
- Delivered and attempted are distinct numbers; never label delivered as "sent".
- Every KPI card carries an ⓘ tooltip stating its formula (see `FORMULAE` in
  `src/lib/metrics.ts`).
- Internal recipients and test sends are excluded by default, and the exclusion
  is stated on screen — never silently applied.

## Voice

Sentence case. A verb the user would say aloud — "Send report", never "Submit".
State the number honestly and round it down. An error names the state, the cause
and the next action, preserves everything the user typed, and never blames them.
