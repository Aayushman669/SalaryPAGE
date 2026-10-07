export default function Loading() {
  return (
    <main
      aria-busy="true"
      className="ui-consistency-surface min-h-screen bg-background px-6 py-10 text-foreground sm:px-8 sm:py-14 lg:px-12"
      role="status"
    >
      <section className="mx-auto flex w-full max-w-6xl flex-col items-center">
        <nav className="mb-12 flex w-full justify-end">
          <div className="h-10 w-28 animate-pulse rounded-xl bg-skeleton" />
        </nav>
        <div className="w-full max-w-2xl text-center">
          <div className="mx-auto h-4 w-28 animate-pulse rounded-full bg-skeleton" />
          <div className="mx-auto mt-5 h-12 w-72 max-w-full animate-pulse rounded-xl bg-skeleton" />
          <div className="mx-auto mt-4 h-6 w-full max-w-xl animate-pulse rounded-full bg-skeleton" />
        </div>
        <div className="mt-10 h-20 w-full max-w-5xl animate-pulse rounded-xl border border-border bg-card" />
        <div className="mt-10 h-56 w-full max-w-5xl animate-pulse rounded-2xl border border-border bg-card" />
        <div className="mt-8 h-64 w-full max-w-5xl animate-pulse rounded-2xl border border-border bg-card" />
      </section>
    </main>
  );
}
