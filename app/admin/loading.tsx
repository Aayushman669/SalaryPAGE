export default function Loading() {
  return (
    <main className="min-h-screen bg-[var(--background)] px-4 py-10 text-[var(--foreground)] sm:px-8 lg:pl-72">
      <section className="mx-auto max-w-5xl">
        <img alt="JobForge" className="mb-8 h-10 w-10" height={40} src="/brand/jobforge-monogram-dark.svg" width={40} />
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-gray-500 dark:text-gray-400">Admin</p>
        <h1 className="mt-3 text-3xl font-bold">Loading admin console</h1>
        <div className="mt-8 h-40 animate-pulse rounded-2xl bg-[var(--skeleton)]" aria-label="Loading admin console" />
      </section>
    </main>
  );
}
