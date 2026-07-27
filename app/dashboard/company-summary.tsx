"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getCompanyAssetUrl, type CompanyProfile } from "@/lib/company-profile";

function formatVerificationStatus(status: CompanyProfile["verification_status"]) {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

export default function DashboardCompanySummary({
  company,
}: {
  company: CompanyProfile | null;
}) {
  const [logoUrl, setLogoUrl] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    if (!company?.logo_path) {
      return () => {
        active = false;
      };
    }

    void getCompanyAssetUrl(company.logo_path).then((url) => {
      if (active) {
        setLogoUrl(url);
      }
    });

    return () => {
      active = false;
    };
  }, [company?.logo_path]);

  const companyInitial = company?.name.slice(0, 1).toUpperCase() || "C";
  const visibleLogoUrl = company?.logo_path ? logoUrl : null;

  return (
    <section className="mt-8 flex flex-col gap-4 rounded-2xl border border-gray-200 bg-gray-50 p-4 shadow-sm dark:bg-white/5 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-center gap-3">
        <span className="flex h-14 w-14 shrink-0 overflow-hidden rounded-2xl border border-gray-200 bg-white dark:bg-white/10">
          {visibleLogoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              alt={`${company?.name ?? "Company"} logo`}
              className="h-full w-full object-cover"
              decoding="async"
              loading="lazy"
              onError={() => setLogoUrl(null)}
              src={visibleLogoUrl}
            />
          ) : (
            <span className="m-auto text-lg font-black text-gray-500">
              {companyInitial}
            </span>
          )}
        </span>
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-500">
            Company profile
          </p>
          <p className="truncate text-base font-bold text-gray-900">
            {company?.name || "Create your company profile"}
          </p>
          <p className="mt-1 text-sm text-gray-500">
            {company
              ? `${formatVerificationStatus(company.verification_status)} · ${company.profile_completion}% complete`
              : "Add your company identity to strengthen future listings."}
          </p>
        </div>
      </div>
      <Link
        href="/settings/profile"
        className="inline-flex h-10 shrink-0 items-center justify-center rounded-xl border border-gray-900 bg-white px-4 text-sm font-semibold text-gray-900 transition hover:bg-yellow-50 focus:outline-none focus:ring-4 focus:ring-yellow-200 dark:bg-white/5"
      >
        {company ? "Edit Company" : "Create Company"}
      </Link>
    </section>
  );
}
