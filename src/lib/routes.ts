/**
 * Client-side route constants.
 *
 * Centralizing these means renames stay in sync across:
 *   - <Link href={...}>
 *   - router.push(...)
 *   - signIn(..., { callbackUrl })
 *   - NextAuth pages config (signIn, error)
 *   - revalidatePath calls in Server Actions
 *
 * Static routes are string constants. Parameterized routes are
 * functions returning the formatted path.
 */
export const ROUTES = {
  home: '/',
  login: '/login',
  loginWithRegisteredFlag: '/login?registered=true',
  register: '/register',
  forgotPassword: '/forgot-password',
  openChat: '/open-chat',
  chat: (id: string) => `/chat?id=${id}`,
  podcast: '/podcast',
  settings: '/settings',
  settingsAccount: '/settings#account',
  settingsCustomNpc: '/settings/custom-npc',
} as const;
