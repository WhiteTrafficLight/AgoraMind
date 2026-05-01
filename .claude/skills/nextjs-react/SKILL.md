---
name: nextjs-react
description: Next.js 16 App Router and React 19 patterns — Server/Client Components, hooks, Server Actions, async params.
when_to_use: |
  Apply when writing components, pages, layouts, routes, data fetching, Server Actions, or API handlers.
  Covers Server vs Client boundaries, async params/searchParams, React 19 hooks (use, useFormStatus, useOptimistic), ref-as-prop.
  Trigger phrases: "use client", "Server Component", "App Router", "Server Action", "useEffect", "params", "metadata", "revalidate".
  Do NOT use for styling (see tailwind skill), lint config (see eslint-config skill), or pure type definitions (see typescript skill).
allowed-tools: Read Grep Glob
---

# Next.js 16 + React 19

## Core Rules

- Default to **Server Components**. Add `'use client'` only when needed.
- `'use client'` is required for: `useState`, `useEffect`, event handlers, browser APIs.
- Server Components support `async/await` directly — never use `useEffect` for data fetching in them.
- Turbopack is the default bundler — no `--turbopack` flag needed.

## Directory Structure

```
src/
├── app/                    # App Router
│   ├── layout.tsx
│   ├── page.tsx
│   └── [slug]/page.tsx
├── components/
│   ├── ui/                 # Primitive UI components
│   └── features/           # Domain-specific components
├── lib/                    # Utilities, API clients
├── hooks/                  # Client-only custom hooks
└── types/                  # Global type definitions
```

## Server Component Pattern

```tsx
// app/users/page.tsx
export default async function UsersPage() {
  const users = await fetchUsers() // direct await — no useEffect
  return <UserList users={users} />
}
```

## Client Component Pattern

```tsx
'use client'

import { useState } from 'react'

export function Counter() {
  const [count, setCount] = useState(0)
  return <button onClick={() => setCount(c => c + 1)}>{count}</button>
}
```

## Server Actions

```tsx
// app/actions.ts
'use server'

export async function createPost(formData: FormData) {
  const title = formData.get('title') as string
  await db.post.create({ data: { title } })
  revalidatePath('/posts')
}
```

```tsx
// Usage in a component
<form action={createPost}>
  <input name="title" />
  <button type="submit">Submit</button>
</form>
```

## Data Fetching

```tsx
// Static (SSG) — cached at build time
const res = await fetch(url, { cache: 'force-cache' })

// Dynamic (SSR) — fresh on every request
const res = await fetch(url, { cache: 'no-store' })

// ISR — revalidate every N seconds
const res = await fetch(url, { next: { revalidate: 3600 } })
```

## Metadata

```tsx
// Static
export const metadata: Metadata = { title: 'Page Title' }

// Dynamic
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params
  return { title: `Post ${id}` }
}
```

---

## Gotchas ⚠️

### params and searchParams are now Promises

```tsx
// ✅ Correct
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ q: string }>
}) {
  const { id } = await params
  const { q } = await searchParams
}

// ❌ Wrong — destructuring without await
export default async function Page({ params: { id } }) { ... }
```

### cookies() and headers() are async

```tsx
// ✅ Correct
const cookieStore = await cookies()
const headersList = await headers()

// ❌ Wrong
const cookieStore = cookies()
```

### React 19: ref is now a plain prop — no forwardRef

```tsx
// ✅ React 19
function Input({ ref, ...props }: { ref: React.Ref<HTMLInputElement> } & React.InputHTMLAttributes<HTMLInputElement>) {
  return <input ref={ref} {...props} />
}

// ❌ Old pattern — forwardRef no longer needed
const Input = forwardRef<HTMLInputElement, Props>((props, ref) => ...)
```

### React 19: use() hook

```tsx
// Unwrap a Promise inside a component (pair with Suspense)
const data = use(dataPromise)

// Replace useContext
const value = use(MyContext)
```

### React 19: useFormStatus()

```tsx
'use client'
import { useFormStatus } from 'react-dom'

function SubmitButton() {
  const { pending } = useFormStatus()
  return <button disabled={pending}>{pending ? 'Submitting...' : 'Submit'}</button>
}
```

### React 19: useOptimistic()

```tsx
const [optimisticItems, addOptimistic] = useOptimistic(
  items,
  (state, newItem) => [...state, newItem],
)
```

---

## Never Do

- `useState` or `useEffect` inside a Server Component
- Mixing `pages/` and `app/` directories — use `app/` only
- Destructuring `params` or `searchParams` without `await`
- Direct DB access from a Client Component
