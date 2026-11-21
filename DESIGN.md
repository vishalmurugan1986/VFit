# VFit design system

One visual source of truth for every screen. Tokens live in `src/index.css`; components live in
`src/components/ui.tsx` (plus `charts.tsx` and `chartParts.tsx` for data). Screens compose components
and never invent new sizes, colours or radii.

Built with the Apple Human Interface Guidelines (iOS text styles, grouped lists, navigation bar,
sheets, 44pt touch targets), the data-viz rules (chart marks, stat tiles, meters) and the design-system
audit rules (one token per repeated value, components with variants, sizes and pressed states).

## Colour

The Apple Fitness iOS palette (dark by default, iOS light as the alternative). Use the tokens, never hex.

| Token | Use |
|---|---|
| `page` / `surface` / `surface-2` / `surface-3` | screen background, cards, raised layers |
| `ink` / `ink-2` / `muted` | primary text, secondary text, tertiary marks (chevrons, axis labels) |
| `fill` / `fill-2` | iOS control fills: segmented tracks, chips, gray buttons, fields, pressed rows |
| `accent` (+ `on-accent`, `accent-ink`, `accent-soft`, `accent-line`) | the one action colour (lime); fills carry `on-accent` text, accent text uses `accent-ink` |
| `move` / `exercise` / `stand` | the three goals on Today (calories, exercise minutes, protein) |
| `strength` / `cardio` / `body` / `nutrition` / `supplement` | fixed identity per feature (icons, chart marks) |
| `good` / `warning` / `critical` (+ `good-ink`, `bad-ink`) | status only, always with an icon or words |
| `bar` / `bar-line` | translucent navigation and tab bars, hairline separators |

Data colours mark identity (a bar, a dot, an icon); **numbers and labels stay in `ink` / `ink-2`**.

## Type

iOS text styles at their default sizes. Every piece of text uses one of these utilities.

| Utility | Size / line | Use |
|---|---|---|
| `text-largetitle` | 34/41 bold | screen title (from `PageHeader`) |
| `text-title1` | 28/34 bold | big figures inside cards |
| `text-title2` | 22/28 bold | section titles (`SectionHeader`), stat-tile values |
| `text-title3` | 20/25 semibold | values in goal rows, timers |
| `text-headline` | 17/22 semibold | card titles, sheet titles, emphasised row text |
| `text-body` | 17/22 | row titles, buttons, body copy |
| `text-callout` | 16/21 | fields |
| `text-subhead` | 15/20 | secondary copy, small buttons |
| `text-footnote` | 13/18 | row subtitles, hints, labels |
| `text-caption` / `text-caption2` | 12/16, 11/13 | table headers, tiny day letters |

Numbers use `font-rounded` (SF Pro Rounded on Apple devices). The single hero figure on a screen is
48px. Use `tabular-nums` only where numbers line up in columns.

## Space, shape, motion

- 4-point grid: 16px screen edge and card padding, 12px between cards, 32px before a section title.
- Radius: cards and large buttons 12px (`rounded-xl`), small buttons and chips are capsules
  (`rounded-full`), segmented controls 9px, sheets 16px.
- Hairlines are half-pixel `bar-line`, inset to the text in lists.
- Motion: screens rise in (0.28s, iOS ease), sheets slide up, presses scale to 0.97 and dim. All of it
  stops under "reduce motion".

## Components

| Component | Use |
|---|---|
| `PageHeader` | every screen: sticky navigation bar (back with the previous screen's name, actions on the right) and the large title; the bar turns translucent and shows the title once you scroll |
| `SectionHeader`, `GroupLabel` | a section's Title 2 heading (with an optional link), or the small uppercase label above a grouped list |
| `Card` | the one card: surface, 12px corners, 16px padding |
| `List` + `ListRow` | grouped lists: icon chip, title, subtitle, value, chevron; links or buttons with pressed state |
| `Button` | `primary` (one per screen), `tinted`, `secondary`, `outline`, `ghost`, `danger`, `danger-ghost`; sizes `sm` (32px, 44px touch), `md` (44px), `lg` (50px) |
| `IconButton` | icon-only, `plain` / `tint` / `fill`, always labelled, 44px touch |
| `Segmented`, `Chip`, `Switch`, `Stepper`, `TimeField` | iOS controls; segmented and switch have 44px touch bands |
| `Sheet`, `ActionSheet` | bottom sheets with a grabber, centred title and round close button |
| `Stat`, `Meter` | stat tiles (label, value, unit, delta with arrow) and progress meters (track is a light step of the fill) |
| `EmptyState`, `PageLoading` | empty screens with an action; skeleton while loading |
| `TimeChart`, `ColumnChart`, `Sparkline`, `Legend`, `ChartTable` | charts: see below |

## Charts

2px lines with an 8px end-dot ringed in the surface colour; bars at most 22px wide with 4px rounded
tops; hairline solid grid on clean round ticks (0, 1,000, 2,000); the current period (or chosen day)
emphasised and the rest de-emphasised; phase shading only when the range crosses phases; a tooltip on
hover and a "Show data" table so no value is hover-only. Never two y-axes.

## Checking a change

- `npm run check` (types, lint, tests) and `npm run build`.
- Open the dev server with `?demo` (`http://localhost:5173/?demo#/`) to fill that browser with six weeks of
  sample data; `?demo=workout` also starts a workout, `?demo=light` switches to the light theme. Demo
  code only runs on the dev server and is never in a build. It replaces that browser's data, so use it
  on a test port, not the browser that holds your own log.
