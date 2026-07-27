export default function Loading() {
  return (
    <main
      aria-busy="true"
      className="min-h-screen bg-background px-6 py-10 text-foreground sm:px-8 sm:py-14 lg:px-12"
      role="status"
    >
      <article className="mx-auto w-full max-w-6xl">
        <div className="mb-8 flex justify-between gap-3">
          <div className="h-10 w-28 animate-pulse rounded-xl bg-skeleton" />
          <div className="h-4 w-32 animate-pulse rounded-full bg-skeleton" />
        </div>
        <header className="overflow-hidden rounded-3xl border border-border bg-card">
          <div className="h-48 animate-pulse bg-skeleton sm:h-64" />
          <div className="h-36 animate-pulse bg-card" />
        </header>
        <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <div className="grid gap-6">
            <div className="h-72 animate-pulse rounded-2xl border border-border bg-card" />
            <div className="h-48 animate-pulse rounded-2xl border border-border bg-card" />
          </div>
          <div className="h-64 animate-pulse rounded-2xl border border-border bg-card" />
        </div>
      </article>
    </main>
  );
}
