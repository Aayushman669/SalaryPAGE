import Link from "next/link";

export default function SuccessPage() {
  return (
    <main className="ui-consistency-surface flex min-h-screen items-center justify-center bg-white px-6 py-16 text-gray-900 sm:px-8 lg:px-12">
      <section className="w-full max-w-xl rounded-xl border border-gray-200 bg-white p-8 text-center shadow-[0_24px_70px_rgba(17,24,39,0.10)] sm:p-10">
        <div className="mx-auto mb-6 flex h-12 w-12 items-center justify-center rounded-full bg-yellow-500 text-lg font-black text-gray-900">
          OK
        </div>
        <h1 className="text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl">
          Payment Successful
        </h1>
        <p className="mt-5 text-lg leading-8 text-gray-500">
          You can now post your job
        </p>

        <Link
          href="/post-job"
          className="mt-8 inline-flex h-12 items-center justify-center rounded-xl bg-black px-6 text-base font-semibold text-white transition-all duration-200 hover:shadow-[0_0_0_4px_rgba(234,179,8,0.16),0_16px_34px_rgba(17,24,39,0.18)] focus:outline-none focus:ring-4 focus:ring-yellow-200"
        >
          Post a Job
        </Link>
      </section>
    </main>
  );
}
