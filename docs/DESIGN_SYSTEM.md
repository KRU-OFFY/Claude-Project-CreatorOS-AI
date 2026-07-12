# Design System — CreatorOS AI

A rules doc for integrating Figma designs (via the Figma MCP) into this codebase.
It describes where design tokens, components, and styling live, and how to map a
Figma design onto them. UI copy is **Thai**; code, identifiers, and comments are
**English**.

> Precedence when translating a Figma design: **the user's explicit words → this
> system → your own choices.** Never introduce a parallel token set or component
> when one already exists here — extend it.

---

## 1. Token Definitions

**Single source of truth: `app/globals.css`.** Tokens are plain CSS custom
properties on `:root`, bridged to Tailwind v4 utilities via `@theme inline`.

```css
/* app/globals.css */
:root {
  --background: #0f172a; /* Deep Navy */
  --foreground: #e2e8f0; /* soft slate on navy */
  --brand: #2563eb;      /* Electric Blue */
  --brand-2: #7c3aed;    /* AI Purple */
  --success: #10b981;    /* Success Green */
  --surface: rgba(255, 255, 255, 0.045);
  --line: rgba(255, 255, 255, 0.09);
}

@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-brand: var(--brand);
  --color-brand-2: var(--brand-2);
  --color-success: var(--success);
  --color-surface: var(--surface);
  --color-line: var(--line);
}
```

- Each `--color-*` entry auto-generates Tailwind utilities: `bg-brand`,
  `text-foreground`, `border-line`, `from-brand`, `to-brand-2`, etc.
- **Opacity is expressed at the utility, not the token:** `text-foreground/55`,
  `bg-white/[0.045]`, `border-white/10`. This is how the whole app dials contrast.
- **No token transformation pipeline** (no Style Dictionary / Tokens Studio JSON).
  A Figma token maps **directly** to a CSS variable here. To add a brand color,
  add the `--x` on `:root` **and** the matching `--color-x` under `@theme inline`.
- **Type scale & font** are also defined in `app/globals.css` on `body`
  (system stack: `"Segoe UI","Sarabun","Noto Sans Thai",system-ui,…`). There is no
  separate typography token file — size/weight come from Tailwind utilities
  (`text-2xl font-bold tracking-tight`).
- **Spacing / radius** use Tailwind's default scale (`p-5`, `gap-3`, `rounded-2xl`).
  There are no custom spacing tokens; stay on the default scale.
- **Semantic status colors** (badges) intentionally use Tailwind's built-in
  palette (`emerald`/`amber`/`red`/`blue`/`purple`/`orange`) at `/15` fill +
  `/25` ring — see `components/ui.tsx`. These are **separate from the brand
  accent** and should stay semantic (good / warning / critical), not rebranded.

### Brand glows & helpers
```css
/* fixed radial brand glows behind the app */
body { background-image:
  radial-gradient(55rem 55rem at 12% -12%, rgba(37,99,235,.22), transparent 60%),
  radial-gradient(48rem 48rem at 105% 0%, rgba(124,58,237,.20), transparent 55%),
  radial-gradient(42rem 42rem at 50% 120%, rgba(37,99,235,.10), transparent 60%); }

/* gradient brand text */
.text-gradient { background: linear-gradient(100deg, var(--brand), var(--brand-2));
  -webkit-background-clip: text; background-clip: text; color: transparent; }
```

---

## 2. Component Library

**Location: `components/`.** Small, hand-rolled primitives — **no Storybook, no
external UI kit** (no shadcn/Radix/MUI). Server Components by default; add
`"use client"` only for interactivity.

### `components/ui.tsx` — layout & display primitives
| Component | Purpose | Key classes (the "look") |
|---|---|---|
| `PageHeader` | page title + subtitle + optional action | title = `text-2xl font-bold tracking-tight text-gradient` |
| `Card` | glass container | `rounded-2xl border border-white/10 bg-white/[0.045] p-5 shadow-[…] backdrop-blur-xl` |
| `StatTile` | KPI tile with corner glow | glow = `absolute -right-8 -top-10 h-24 w-24 rounded-full bg-brand/25 blur-2xl` |
| `TierBadge` | product tier pill | `bg-{c}-500/15 text-{c}-300 ring-1 ring-inset ring-{c}-400/25` |
| `StatusBadge` | workflow status pill | keyed map in `statusColors` |
| `EmptyState` | dashed empty container | `border-dashed border-white/15 bg-white/[0.02]` |
| `Th` / `Td` | table header / cell | token-based borders + muted header |

### `components/Logo.tsx` — brand mark
- `LogoMark` — the hexagonal "AI core + 8 platform nodes" SVG. Uses `currentColor`
  for spokes/ring so it inherits `text-foreground`; brand gradient is inline.
- Sizing via `className` (`h-9 w-9`, `h-16 w-16`). Used in `Sidebar` and `/login`.

**Rule:** when a Figma frame maps to one of these, **reuse the component** and pass
props/`className` — don't inline a new div with duplicated classes.

---

## 3. Frameworks & Libraries

| Concern | Choice |
|---|---|
| Framework | **Next.js 15.5** (App Router, RSC) |
| UI runtime | **React 19** |
| Language | **TypeScript 5** (strict; `npm run typecheck`) |
| Styling | **Tailwind CSS v4** via `@tailwindcss/postcss` (`postcss.config.mjs`) |
| Data / auth | Supabase (`@supabase/ssr`, `@supabase/supabase-js`) |
| AI | `@anthropic-ai/sdk` |
| Build / bundler | Next.js built-in (Turbopack/webpack) — `npm run build` |
| Tests | Vitest (`npm test`) |

Tailwind v4 is **CSS-config, not `tailwind.config.js`** — there is no JS config
file; theme lives in `@theme inline` inside `app/globals.css`. `postcss.config.mjs`
just wires the plugin:
```js
// postcss.config.mjs
export default { plugins: { "@tailwindcss/postcss": {} } };
```

---

## 4. Asset Management

- **Minimal assets by design.** No `public/images` pipeline, no image CDN, no
  `next/image` remote loaders configured.
- **Brand/app icon:** `app/icon.svg` (App-Router metadata icon → browser tab).
  It's a self-contained SVG with fixed hex colors (favicons can't inherit
  `currentColor`).
- **Decorative graphics are code, not files:** brand glows are CSS radial
  gradients; the logo and small marks are inline SVG.
- When a Figma export needs a raster asset, prefer inlining an optimized SVG or a
  `data:` URI over adding binary files; keep the repo asset-light.

---

## 5. Icon System

Three tiers, by context:
1. **Navigation icons = emoji**, defined centrally in **`lib/nav.ts`** (`icon` field
   on each `NavItem`). No icon font, no `lucide`/`heroicons` dependency.
   ```ts
   { href: "/products", label: "สินค้า", icon: "🔍", group: "เวิร์กโฟลว์" }
   ```
2. **Brand mark = SVG** in `components/Logo.tsx` (`LogoMark`).
3. **Incidental UI glyphs = inline `<svg>`** written where used (e.g. the GitHub
   glyph, checkmarks) with `stroke="currentColor"` so they inherit text color.

**Naming:** there is no icon-name registry — nav emoji live on the data object,
brand art lives in a named component. If a Figma design brings an icon set, add it
as inline SVG components under `components/` (PascalCase, `currentColor` strokes)
rather than a font.

---

## 6. Styling Approach

- **Utility-first Tailwind v4**, token-driven. No CSS Modules, no styled-components,
  no CSS-in-JS.
- **Global styles:** only `app/globals.css` (tokens, body background/glows, focus
  ring, `.text-gradient`). Everything else is utilities on elements.
- **The glass recipe** (repeat this for surfaces):
  `rounded-2xl border border-white/10 bg-white/[0.045] backdrop-blur-xl shadow-[…]`.
- **Dark-first, single theme.** Components read tokens (`text-foreground/NN`,
  `bg-white/NN`, `border-white/NN`), so re-theming = editing `:root` in
  `globals.css`. Form controls set an explicit background (`bg-white/5` on inputs,
  `bg-background` on `<select>`) so native dropdowns/autofill stay readable.
- **Responsive:** mobile-first with `md:` as the primary breakpoint (e.g. the
  sidebar: stacked bar on mobile, `md:sticky md:h-screen md:w-64`). Use
  `grid-cols-2 md:grid-cols-4` patterns; wide content scrolls in its own
  `overflow-x-auto` container.
- **Focus & motion:** a visible `:focus-visible` ring is defined globally; keep it.

### Figma → utilities cheat-sheet
| Figma | Use |
|---|---|
| Fill = brand | `bg-brand` / gradient `bg-gradient-to-r from-brand to-brand-2` |
| Text muted | `text-foreground/55` (labels `/45`, faint `/40`) |
| Card / surface | the glass recipe above (or `<Card>`) |
| Divider / stroke | `border-white/10` |
| Radius (cards) | `rounded-2xl`; controls `rounded-lg` |
| Heading accent | `.text-gradient` |
| Success / warn / danger | semantic Tailwind palette at `/15` + ring `/25` |

---

## 7. Project Structure

```
app/
  globals.css            # tokens (@theme inline) + body glows + helpers  ← design source of truth
  layout.tsx             # root metadata (title/description)
  icon.svg               # brand tab icon
  login/                 # public: LoginForm (client) + page
  setup/                 # env-not-configured fallback
  (dash)/                # authed app group (shared Sidebar)
    Sidebar.tsx          # nav shell (client) — renders lib/nav.ts + LogoMark
    actions.ts           # server actions (mutations)
    dashboard/ products/ campaigns/ content-studio/ compliance/
    publish-center/ calendar/ analytics/ revenue-forecast/ ai-advisor/
    settings/ settings/system/ settings/team/
  api/                   # route handlers (health, cron, connect/*, auth)
components/
  ui.tsx                 # display primitives (Card, StatTile, badges, table)
  Logo.tsx               # LogoMark SVG
lib/
  nav.ts                 # nav registry (labels + emoji icons + groups)
  platforms.ts           # 8-platform registry
  supabase/              # client/server/admin/middleware
  … (ai, compliance, analytics, settings, publish, tokens, …)
supabase/migrations/     # 0001…00NN (RLS on every business table)
docs/                    # specs + this doc
```

**Feature pattern:** each route folder is a Server Component `page.tsx` that reads
data via `lib/data.ts`, renders `components/ui` primitives, and submits mutations to
`app/(dash)/actions.ts` server actions. Client interactivity is isolated to small
`"use client"` components (forms with local state, the sidebar toggle).

---

## Working with the Figma MCP here

1. **Pull tokens first.** Map Figma color/type styles to the CSS variables in
   `app/globals.css` (`:root` + `@theme inline`). Reuse existing token names; only
   add new `--x` / `--color-x` pairs when a genuinely new role appears.
2. **Match components, don't fork them.** A Figma "card/stat/badge/header" maps to
   `Card` / `StatTile` / `TierBadge`+`StatusBadge` / `PageHeader`. Extend via
   props/`className`.
3. **Translate styles to utilities** using the cheat-sheet in §6 — never hardcode
   hex values in JSX; go through tokens (`bg-brand`, `text-foreground/60`).
4. **Keep it dark-first and token-based** so the design stays re-themable from one
   file. Preserve the glass recipe, `.text-gradient`, focus ring, and Thai UI copy.
5. **Verify:** `npm run typecheck` + `npm run build`; spot-check `/login` and a
   dashboard page rendered headless before committing.
