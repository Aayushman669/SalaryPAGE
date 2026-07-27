import type {
  ApplicationRecruiterNote,
  ApplicationStatusHistoryItem,
} from "@/lib/applications";
import ApplicationStatusBadge from "./application-status-badge";

function formatTimelineDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Recently";
  }

  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export default function ApplicationStatusTimeline({
  error,
  history,
  loading = false,
  notes = [],
}: {
  error?: string | null;
  history: ApplicationStatusHistoryItem[];
  loading?: boolean;
  notes?: ApplicationRecruiterNote[];
}) {
  if (loading) {
    return (
      <div aria-busy="true" aria-label="Loading status history" className="grid gap-3">
        {[0, 1].map((item) => (
          <div
            className="h-16 animate-pulse rounded-xl border border-gray-200 bg-gray-50"
            key={item}
          />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <p className="rounded-xl border border-gray-200 bg-gray-50 p-4 text-sm leading-6 text-gray-500">
        {error}
      </p>
    );
  }

  const events = [
    ...history.map((entry) => ({
      date: entry.createdAt,
      entry,
      id: `status-${entry.id}`,
      kind: "status" as const,
    })),
    ...notes.map((note) => ({
      date: note.createdAt,
      id: `note-${note.id}`,
      kind: "note" as const,
      note,
    })),
  ].sort((left, right) => {
    const rightTime = new Date(right.date).getTime();
    const leftTime = new Date(left.date).getTime();
    return (Number.isFinite(rightTime) ? rightTime : 0) -
      (Number.isFinite(leftTime) ? leftTime : 0);
  });

  if (events.length === 0) {
    return (
      <p className="rounded-xl border border-gray-200 bg-gray-50 p-4 text-sm leading-6 text-gray-500">
        Status history will appear here after the workflow migration is applied.
      </p>
    );
  }

  return (
    <ol aria-label="Application status history" className="grid gap-3">
      {events.map((event) => (
        <li
          className="relative rounded-xl border border-gray-200 bg-gray-50 p-4"
          key={event.id}
        >
          <div className="flex flex-wrap items-start justify-between gap-2">
            {event.kind === "status" ? (
              <ApplicationStatusBadge compact status={event.entry.newStatus} />
            ) : (
              <span className="inline-flex h-6 items-center rounded-full border border-yellow-200 bg-yellow-50 px-2 text-[10px] font-semibold text-yellow-900">
                Recruiter note
              </span>
            )}
            <time
              className="text-xs font-medium text-gray-500"
              dateTime={event.date}
            >
              {formatTimelineDate(event.date)}
            </time>
          </div>
          {event.kind === "status" ? (
            <>
              <p className="mt-2 text-xs font-semibold text-gray-600">
                Changed by {event.entry.changedByDisplay}
              </p>
              {event.entry.note ? (
                <p className="mt-2 whitespace-pre-line text-sm leading-6 text-gray-600">
                  {event.entry.note}
                </p>
              ) : null}
            </>
          ) : (
            <p className="mt-2 whitespace-pre-line text-sm leading-6 text-gray-600">
              {event.note.note}
            </p>
          )}
        </li>
      ))}
    </ol>
  );
}
