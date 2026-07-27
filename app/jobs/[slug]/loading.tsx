export default function Loading() {
  return (
    <main
      aria-busy="true"
      className="min-h-screen bg-background px-6 py-10 text-foreground sm:px-8 sm:py-14 lg:px-12"
      role="status"
    >
      <article className="mx-auto w-full max-w-6xl">
        <div className="mb-8 h-10 w-28 animate-pulse rounded-xl bg-skeleton" />
        <header className="overflow-hidden rounded-3xl border border-border bg-card">
          <div className="h-72 animate-pulse bg-skeleton sm:h-80" />
        </header>
        <div className="mt-6 grid gap-5 lg:grid-cols-[1fr_20rem]">
          <div className="grid gap-5">
            <div className="h-72 animate-pulse rounded-2xl border border-border bg-card" />
            <div className="h-48 animate-pulse rounded-2xl border border-border bg-card" />
          </div>
          <div className="h-96 animate-pulse rounded-2xl border border-border bg-card" />
        </div>
      </article>
    </main>
  );
}
