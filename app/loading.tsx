export default function Loading() {
  return (
    <main className="min-h-screen bg-white px-6 py-16 text-gray-900 sm:px-8 lg:px-12">
      <section className="mx-auto flex w-full max-w-6xl flex-col items-center">
        <nav className="mb-14 flex w-full items-center justify-end">
          <div className="rounded-xl bg-black px-4 py-2 text-sm font-semibold text-white shadow-[0_12px_28px_rgba(17,24,39,0.16)]">
            Post a Job
          </div>
        </nav>

        <div className="max-w-3xl text-center">
          <img
            alt="JobForge"
            className="mx-auto mb-7 h-10 w-auto dark:hidden"
            height={40}
            src="/brand/jobforge-logo-light.svg"
            width={182}
          />
          <img
            alt="JobForge"
            className="mx-auto mb-7 hidden h-10 w-auto dark:block"
            height={40}
            src="/brand/jobforge-logo-dark.svg"
            width={182}
          />
          <h1 className="text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl lg:text-6xl">
            Forge Your Future Career
          </h1>
          <p className="mt-5 text-lg leading-8 text-gray-500 sm:text-xl">
            Discover jobs, connect with recruiters, and build your future with JobForge.
          </p>
        </div>

        <div className="mt-14 w-full rounded-xl border border-gray-200 bg-white p-8 text-center shadow-[0_18px_45px_rgba(17,24,39,0.08)]">
          <p className="text-base font-semibold text-gray-700">
            Loading jobs...
          </p>
        </div>
      </section>
    </main>
  );
}
