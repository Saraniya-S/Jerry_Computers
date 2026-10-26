/** Placeholder while the auth form waits on the request (session cookie, search params). */
export function AuthFormSkeleton() {
  return (
    <div className="animate-pulse" aria-busy="true" aria-label="Loading">
      <div className="h-11 w-3/4 rounded-xl bg-ink-900" />
      <div className="mt-4 h-4 w-2/3 rounded bg-ink-900" />
      <div className="mt-8 h-12 rounded-full bg-ink-900" />
      <div className="mt-8 grid gap-3">
        <div className="h-14 rounded-2xl bg-ink-900" />
        <div className="h-14 rounded-2xl bg-ink-900" />
      </div>
      <div className="mt-6 h-12 rounded-full bg-ink-900" />
    </div>
  );
}
