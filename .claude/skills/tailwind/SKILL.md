---
name: tailwind
description: Tailwind CSS v4 styling — utility classes, design tokens, conditional classes with cn().
when_to_use: |
  Apply when adding styles to components, configuring @theme custom properties, or debugging visual output.
  Covers Tailwind v4 utility class ordering, cn() conditional composition, @theme tokens, custom @layer utilities, and v3→v4 migration gotchas.
  Trigger phrases: "className", "Tailwind", "@theme", "design token", "cn(", "twMerge", "globals.css", "dark mode", "shadow", "bg-".
  Do NOT use for ESLint config (see eslint-config skill), component logic (see nextjs-react skill), or TypeScript types (see typescript skill).
allowed-tools: Read Grep Glob
---

# Tailwind CSS v4

## Key Changes from v3

- No `tailwind.config.js` — configuration lives inside CSS with `@theme`.
- Single import: `@import "tailwindcss"` replaces all `@tailwind` directives.
- Design tokens defined as CSS custom properties, not JS objects.
- JIT is always on — no configuration needed.

## CSS Setup

```css
/* app/globals.css */
@import "tailwindcss";

@theme {
  /* Colors */
  --color-primary: #3b82f6;
  --color-primary-hover: #2563eb;
  --color-background: #ffffff;
  --color-foreground: #0f172a;
  --color-muted: #f1f5f9;

  /* Typography */
  --font-sans: 'Pretendard Variable', sans-serif;
  --font-mono: 'JetBrains Mono', monospace;

  /* Custom breakpoints */
  --breakpoint-xs: 480px;
}
```

## Class Order Convention

Layout → Spacing → Sizing → Typography → Color → Effects → State

```tsx
// ✅ Correct order
<div className="flex items-center gap-4 px-6 py-4 w-full max-w-md text-sm font-medium text-foreground bg-background rounded-xl shadow-md hover:shadow-lg transition-shadow" />
```

## Conditional Classes — always use cn()

```ts
// lib/utils.ts
import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
```

```tsx
<button
  className={cn(
    'px-4 py-2 rounded-lg font-medium transition-colors',
    variant === 'primary' && 'bg-primary text-white hover:bg-primary-hover',
    variant === 'ghost' && 'bg-transparent hover:bg-muted',
    disabled && 'opacity-50 cursor-not-allowed',
  )}
/>
```

## Custom Utilities

```css
@layer components {
  .btn-primary {
    @apply px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-hover transition-colors;
  }
}

@layer utilities {
  .text-balance {
    text-wrap: balance;
  }
}
```

---

## Gotchas ⚠️

- **Dark mode**: Now media-query based by default. Class-based dark mode requires a custom `@variant dark` — it is no longer a simple config option.
- **`bg-opacity-*` removed**: Use slash syntax instead — `bg-black/50`, `text-white/80`.
- **`theme()` in CSS**: Still works inside CSS files, but access tokens as CSS vars in JS — `var(--color-primary)`.
- **Shadow values changed**: Visually verify `shadow-sm`, `shadow-md`, etc. — values differ from v3.
- **CSS var arbitrary values**: Use parentheses `bg-(--brand)`, not brackets `bg-[--brand]` (v3 syntax).
- **Important modifier**: Suffix form `text-red-500!`, not prefix `!text-red-500` (v3 syntax).

---

## Never Do

- Mix inline `style={{}}` with Tailwind classes for the same property
- Use arbitrary values (`w-[347px]`) for anything that should be a design token
- Use `bg-opacity-*` — use slash syntax (`bg-black/50`) instead
- Configure tokens in JS — they belong in `@theme {}` in CSS
