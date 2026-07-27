import { getApplicationStatusDisplay } from "@/lib/applications";

export default function ApplicationStatusBadge({
  compact = false,
  status,
}: {
  compact?: boolean;
  status: string | null | undefined;
}) {
  const display = getApplicationStatusDisplay(status);

  return (
    <span
      aria-label={`Application status: ${display.label}`}
      className={`inline-flex max-w-full shrink-0 items-center gap-1.5 rounded-full border font-medium leading-none ${display.className} ${
        compact
          ? "h-6 px-2 text-[10px]"
          : "h-7 px-2.5 text-xs"
      }`}
      title={display.description}
    >
      <span
        aria-hidden="true"
        className={`h-1.5 w-1.5 shrink-0 rounded-full ${display.iconClassName}`}
      />
      <span className="truncate">{display.label}</span>
    </span>
  );
}
