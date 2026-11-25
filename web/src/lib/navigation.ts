/**
 * Only same-app paths are allowed as a post-sign-in destination, so ?next=
 * can't send users to another site ("//evil.example" or "/\evil.example").
 */
export function safeNext(next: string | null): string {
  return next && /^\/(?![/\\])/.test(next) ? next : '/dashboard'
}
