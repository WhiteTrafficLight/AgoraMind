---
name: typescript
description: TypeScript 6 strict typing — interfaces, generics, utility types, type guards, and tsconfig settings.
when_to_use: |
  Apply when writing or reviewing TypeScript code, defining types, or fixing strict-mode errors.
  Trigger phrases: "type safety", "avoid any", "generic constraint", "tsconfig", "type guard", "interface vs type".
  Do NOT use for component rendering logic (see nextjs-react skill), styling (see tailwind skill), or lint config (see eslint-config skill).
allowed-tools: Read Grep Glob
---

# TypeScript 6

## Core Rules

- `strict: true` always — no exceptions.
- Never use `any`. Use `unknown` and narrow with type guards.
- Prefer `interface` over `type` for object shapes (extensible). Use `type` for unions and intersections.
- Always annotate return types explicitly.
- Prefer `undefined` over `null`.

## tsconfig

```json
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "noImplicitReturns": true,
    "target": "ES2022",
    "moduleResolution": "bundler",
    "paths": { "@/*": ["./src/*"] }
  }
}
```

## Type Definition Patterns

```ts
// Object shapes → interface
interface User {
  id: string
  name: string
  email: string
}

// Unions, intersections → type
type Status = 'pending' | 'success' | 'error'
type Result<T> = { data: T; error: null } | { data: null; error: Error }

// Component props → interface
interface ButtonProps {
  label: string
  onClick: () => void
  variant?: 'primary' | 'secondary'
  disabled?: boolean
}
```

## Generics

```ts
// Always constrain generics
function getProperty<T, K extends keyof T>(obj: T, key: K): T[K] {
  return obj[key]
}

// Default type parameter
interface ApiResponse<T = unknown> {
  data: T
  status: number
  message: string
}
```

## Utility Types

```ts
type UserPreview = Pick<User, 'id' | 'name'>
type PartialUser = Partial<User>
type ReadonlyUser = Readonly<User>
type UserWithoutId = Omit<User, 'id'>

const statusMap: Record<Status, string> = {
  pending: 'Processing',
  success: 'Done',
  error: 'Failed',
}
```

## unknown + Type Guards

```ts
// Narrow unknown before use
function processInput(input: unknown): string {
  if (typeof input === 'string') return input
  if (typeof input === 'number') return String(input)
  throw new Error('Unsupported input type')
}

// Type guard function
function isUser(value: unknown): value is User {
  return (
    typeof value === 'object' &&
    value !== null &&
    'id' in value &&
    'name' in value
  )
}
```

## Error Handling

```ts
// Always catch as unknown
try {
  await fetchData()
} catch (error) {
  if (error instanceof Error) console.error(error.message)
}

// Result pattern for expected failures
async function safeFetch<T>(url: string): Promise<Result<T>> {
  try {
    const res = await fetch(url)
    const data: T = await res.json()
    return { data, error: null }
  } catch (error) {
    return { data: null, error: error instanceof Error ? error : new Error('Unknown') }
  }
}
```

## Import Order

```ts
import { type FC } from 'react'           // 1. react
import { useRouter } from 'next/navigation' // 2. next
import { clsx } from 'clsx'               // 3. external libraries
import { fetchUser } from '@/lib/api'      // 4. internal @/ alias
import { Button } from './Button'          // 5. relative
```

---

## Gotchas ⚠️

### noUncheckedIndexedAccess — array access returns T | undefined

```ts
const arr = [1, 2, 3]
const first = arr[0] // number | undefined — not number!

// Must guard before use
if (first !== undefined) console.log(first * 2)
```

### exactOptionalPropertyTypes — undefined is not a valid optional value

```ts
interface Foo { bar?: string }

// ❌ Error
const foo: Foo = { bar: undefined }

// ✅ Correct
const foo: Foo = {}
```

### as assertions — use only with type guards, not as a shortcut

```ts
// ❌ Lazy — bypasses type safety
const user = data as User

// ✅ Safe — assert only after guard
if (isUser(data)) {
  const user = data // already User
}
```

---

## Never Do

- Use `any` — use `unknown` instead
- Use `// @ts-ignore` — use `// @ts-expect-error` with an explanation
- Omit return types on exported functions
- Use `as` to bypass type errors without a guard

