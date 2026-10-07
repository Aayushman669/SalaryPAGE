import type { JobPreviewData } from "@/lib/job-form";

function PreviewSection({
  children,
  title,
}: {
  children: React.ReactNode;
  title: string;
}) {
  if (!children) {
    return null;
  }

  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-[0_16px_45px_rgba(17,24,39,0.05)] sm:p-6">
      <h2 className="text-base font-bold tracking-tight text-gray-900">
        {title}
      </h2>
      <div className="mt-4 text-sm leading-7 text-gray-600">{children}</div>
    </section>
  );
}

function RichTextPreview({ value }: { value: string }) {
  if (!value.trim()) {
    return null;
  }

  return <p className="whitespace-pre-line">{value}</p>;
}

export default function JobPreview({
  autoSaveLabel,
  data,
  hasUnsavedChanges,
  isSavingDraft,
  isSubmitting,
  onBackToEdit,
  onSaveDraft,
  onSubmit,
}: {
  autoSaveLabel: string;
  data: JobPreviewData;
  hasUnsavedChanges: boolean;
  isSavingDraft: boolean;
  isSubmitting: boolean;
  onBackToEdit: () => void;
  onSaveDraft: () => void;
  onSubmit: () => void;
}) {
  const hasDescription = Boolean(data.description.trim());
  const hasRequirements = Boolean(data.requirements.trim());
  const hasBenefits = Boolean(data.benefits.trim());
  const hasApplicationMethods = data.applicationMethods.length > 0;

  return (
    <main className="ui-consistency-surface min-h-screen bg-background px-6 py-12 text-foreground sm:px-8 sm:py-16 lg:px-12">
      <section className="mx-auto w-full max-w-5xl">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <div className="max-w-2xl">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-gray-500">
              Job Preview
            </p>
            <h1 className="mt-4 text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl">
              Public listing preview
            </h1>
            <p className="mt-5 text-lg leading-8 text-gray-500">
              Review how candidates will read this job before it is published.
            </p>
          </div>
          <button
            type="button"
            onClick={onBackToEdit}
            className="inline-flex h-11 items-center justify-center rounded-xl border border-gray-200 bg-white px-5 text-sm font-semibold text-gray-900 transition-all duration-200 hover:-translate-y-0.5 hover:bg-yellow-50/60 hover:shadow-[0_12px_28px_rgba(17,24,39,0.08)] focus:outline-none focus:ring-4 focus:ring-yellow-200"
          >
            Back to Edit
          </button>
        </div>

        <article className="mt-10 overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-[0_24px_80px_rgba(17,24,39,0.08)]">
          <div className="border-b border-gray-200 bg-gray-50 px-6 py-8 sm:px-8 sm:py-10">
            <div className="inline-flex rounded-full border border-yellow-200 bg-yellow-50 px-3 py-1 text-xs font-bold uppercase tracking-[0.16em] text-gray-900">
              Preview
            </div>
            <h2 className="mt-5 text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
              {data.title}
            </h2>
            <p className="mt-3 text-lg font-semibold text-gray-700">
              {data.companyName}
            </p>

            {data.meta.length > 0 ? (
              <dl className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {data.meta.map((item) => (
                  <div
                    key={`${item.label}-${item.value}`}
                    className="rounded-2xl border border-gray-200 bg-white px-4 py-3"
                  >
                    <dt className="text-xs font-bold uppercase tracking-[0.14em] text-gray-400">
                      {item.label}
                    </dt>
                    <dd className="mt-1 text-sm font-semibold text-gray-900">
                      {item.value}
                    </dd>
                  </div>
                ))}
              </dl>
            ) : null}
          </div>

          <div className="grid gap-5 p-5 sm:p-6 lg:grid-cols-[1fr_18rem] lg:p-8">
            <div className="grid gap-5">
              {hasDescription ? (
                <PreviewSection title="Description">
                  <RichTextPreview value={data.description} />
                </PreviewSection>
              ) : null}

              {hasRequirements ? (
                <PreviewSection title="Requirements">
                  <RichTextPreview value={data.requirements} />
                </PreviewSection>
              ) : null}

              {hasBenefits ? (
                <PreviewSection title="Benefits">
                  <RichTextPreview value={data.benefits} />
                </PreviewSection>
              ) : null}

            </div>

            <aside className="h-fit rounded-2xl border border-gray-200 bg-white p-5 shadow-[0_16px_45px_rgba(17,24,39,0.05)]">
              <h2 className="text-base font-bold tracking-tight text-gray-900">
                Application
              </h2>
              {hasApplicationMethods ? (
                <div className="mt-4 grid gap-3">
                  {data.applicationMethods.map((method) => (
                    <div
                      key={`${method.label}-${method.value}`}
                      className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3"
                    >
                      <p className="text-xs font-bold uppercase tracking-[0.14em] text-gray-400">
                        {method.label}
                      </p>
                      <p className="mt-1 break-words text-sm font-semibold text-gray-900">
                        {method.value}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-4 text-sm leading-6 text-gray-500">
                  Add an application email or URL before publishing this job.
                </p>
              )}
            </aside>
          </div>
        </article>

        <div className="sticky bottom-4 z-10 mt-6 rounded-2xl border border-gray-200 bg-white/95 p-4 shadow-[0_22px_70px_rgba(17,24,39,0.14)] backdrop-blur">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm font-semibold text-gray-900">
                {autoSaveLabel}
              </p>
              <p className="mt-1 text-xs leading-5 text-gray-500">
                {hasUnsavedChanges
                  ? "Save your latest changes before leaving this page."
                  : "Previewing does not save or publish the job."}
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                onClick={onBackToEdit}
                className="inline-flex h-11 items-center justify-center rounded-xl border border-gray-200 bg-white px-5 text-sm font-semibold text-gray-900 transition-all duration-200 hover:-translate-y-0.5 hover:bg-yellow-50/60 hover:shadow-[0_12px_28px_rgba(17,24,39,0.08)] focus:outline-none focus:ring-4 focus:ring-yellow-200"
              >
                Back to Edit
              </button>
              <button
                type="button"
                onClick={onSaveDraft}
                disabled={isSavingDraft || isSubmitting}
                className="inline-flex h-11 items-center justify-center rounded-xl border border-gray-200 bg-white px-5 text-sm font-semibold text-gray-900 transition-all duration-200 hover:-translate-y-0.5 hover:bg-yellow-50/60 hover:shadow-[0_12px_28px_rgba(17,24,39,0.08)] focus:outline-none focus:ring-4 focus:ring-yellow-200 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-400 disabled:shadow-none"
              >
                {isSavingDraft ? "Saving..." : "Save Draft"}
              </button>
              <button
                type="button"
                disabled
                aria-current="page"
                className="inline-flex h-11 items-center justify-center rounded-xl border border-yellow-300 bg-yellow-50 px-5 text-sm font-semibold text-gray-900 disabled:cursor-default"
              >
                Preview
              </button>
              <button
                type="button"
                onClick={onSubmit}
                disabled={isSubmitting || isSavingDraft}
                className="inline-flex h-11 items-center justify-center rounded-xl bg-black px-5 text-sm font-semibold text-white transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_0_0_4px_rgba(234,179,8,0.16),0_14px_30px_rgba(17,24,39,0.16)] focus:outline-none focus:ring-4 focus:ring-yellow-200 disabled:cursor-not-allowed disabled:bg-gray-400 disabled:shadow-none"
              >
                {isSubmitting ? "Publishing..." : "Publish Job"}
              </button>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
