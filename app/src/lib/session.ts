import { useSession } from '@tanstack/react-start/server'

export type AppSession = { userId: number; sessionVersion: number }

// h3's seal rejects passwords shorter than 32 chars.
function sessionSecret(): string {
  const secret = process.env.SESSION_SECRET
  if (!secret || secret.length < 32) {
    throw new Error('SESSION_SECRET must be set and at least 32 characters')
  }
  return secret
}

// A sealed (encrypted + signed) cookie, not a server-side store. It holds only
// who the user is; the role is read from the DB on every call.
export function useAppSession() {
  return useSession<AppSession>({
    name: 'ops-session',
    password: sessionSecret(),
    maxAge: 60 * 60 * 8,
    // h3 would otherwise also accept the session from an
    // `x-ops-session-session` request header.
    sessionHeader: false,
    cookie: {
      httpOnly: true,
      // h3's default sets no SameSite.
      sameSite: 'lax',
      path: '/',
      secure: process.env.NODE_ENV === 'production',
    },
  })
}
