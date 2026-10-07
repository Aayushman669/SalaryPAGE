export default function AuthLoading() {
  return (
    <main className="ui-consistency-surface flex min-h-screen items-center justify-center bg-white px-6 py-12 text-gray-900">
      <div className="rounded-3xl border border-gray-200 bg-[#FEFEFC] px-8 py-7 text-center shadow-[0_26px_75px_rgba(0,0,0,0.07)]">
        <img
          alt="JobForge"
          className="mx-auto mb-5 h-8 w-auto dark:hidden"
          height={32}
          src="/brand/jobforge-logo-light.svg"
          width={145}
        />
        <img
          alt="JobForge"
          className="mx-auto mb-5 hidden h-8 w-auto dark:block"
          height={32}
          src="/brand/jobforge-logo-dark.svg"
          width={145}
        />
        <div className="mx-auto h-10 w-10 rounded-full border-4 border-gray-200 border-t-yellow-500" />
        <p className="mt-5 text-sm font-semibold text-gray-600">
          Checking authentication...
        </p>
      </div>
    </main>
  );
}
