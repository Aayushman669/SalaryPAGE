"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  type ChangeEvent,
  type FormEvent,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useAuth } from "@/app/auth-context";
import { getProfile, type ProfileRow } from "@/lib/auth-profiles";
import {
  applicationResumeBucket,
  applicationResumeMaxSizeLabel,
  getApplicationStatusDisplay,
  type ApplicationQuestion,
  validateApplicationResumeFile,
} from "@/lib/applications";
import { supabase } from "@/lib/supabase";
import { showErrorToast, showSuccessToast } from "@/lib/toast";
import { validateUploadFileSignature } from "@/lib/upload-validation";

type CandidateApplicationLookup = {
  applied_at?: string | null;
  has_applied?: boolean | null;
  status?: string | null;
};

type FieldErrors = {
  answers?: Record<string, string>;
  resume?: string;
  submit?: string;
};

type JobApplicationPanelProps = {
  applicationsCount: number;
  companyName: string;
  questions?: ApplicationQuestion[];
  slug: string;
  title: string;
};

const defaultQuestions: ApplicationQuestion[] = [];

function createResumePath(userId: string, slug: string) {
  const safeSlug =
    slug
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "job";
  const uniqueId =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

  return `${userId}/${safeSlug}/${uniqueId}.pdf`;
}

function getFriendlyApplyError(error: unknown) {
  if (!error || typeof error !== "object") {
    return "We could not submit your application. Please try again.";
  }

  const errorRecord = error as {
    code?: unknown;
    message?: unknown;
  };
  const code = typeof errorRecord.code === "string" ? errorRecord.code : "";
  const message =
    typeof errorRecord.message === "string" ? errorRecord.message : "";
  const normalized = message.toLowerCase();

  if (code === "23505" || normalized.includes("already_applied")) {
    return "You have already applied to this job.";
  }

  if (normalized.includes("rate_limit_exceeded")) {
    return "You have submitted too many applications. Please wait a few minutes before trying again.";
  }

  if (normalized.includes("job_seeker_required")) {
    return "Only Job Seeker accounts can apply to jobs.";
  }

  if (normalized.includes("cannot_apply_to_own_job")) {
    return "You cannot apply to your own job.";
  }

  if (normalized.includes("job_not_available")) {
    return "This job is no longer accepting applications.";
  }

  if (normalized.includes("invalid_resume")) {
    return "Upload a valid PDF resume before applying.";
  }

  if (normalized.includes("resume_not_found")) {
    return "Resume upload did not finish. Please upload the PDF again.";
  }

  if (
    normalized.includes("bucket") ||
    normalized.includes("storage") ||
    normalized.includes("function") ||
    normalized.includes("schema cache")
  ) {
    return "Applications are not ready yet. Please run the latest Supabase migration.";
  }

  if (normalized.includes("network") || normalized.includes("failed to fetch")) {
    return "We could not connect. Please check your internet connection and try again.";
  }

  return "We could not submit your application. Please try again.";
}

function getFriendlyUploadError(error: unknown) {
  if (!error || typeof error !== "object") {
    return "Resume upload failed. Please try again.";
  }

  const message =
    typeof (error as { message?: unknown }).message === "string"
      ? ((error as { message: string }).message)
      : "";
  const normalized = message.toLowerCase();

  if (normalized.includes("mime") || normalized.includes("pdf")) {
    return "Resume must be a PDF file.";
  }

  if (normalized.includes("size") || normalized.includes("too large")) {
    return `Resume must be ${applicationResumeMaxSizeLabel} or smaller.`;
  }

  if (normalized.includes("bucket") || normalized.includes("not found")) {
    return "Resume storage is not ready yet. Please run the latest Supabase migration.";
  }

  return "Resume upload failed. Please try again.";
}

function normalizeApplicationLookup(
  data: CandidateApplicationLookup | CandidateApplicationLookup[] | null,
) {
  const row = Array.isArray(data) ? data[0] : data;

  return {
    appliedAt: row?.applied_at ?? null,
    hasApplied: row?.has_applied === true,
    status: row?.status ?? null,
  };
}

export default function JobApplicationPanel({
  applicationsCount,
  companyName,
  questions = defaultQuestions,
  slug,
  title,
}: JobApplicationPanelProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { isAuthLoading, isLoggedIn } = useAuth();
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [coverLetter, setCoverLetter] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [hasApplied, setHasApplied] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [resume, setResume] = useState<File | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  const loginHref = useMemo(
    () => `/login?next=${encodeURIComponent(pathname)}`,
    [pathname],
  );
  const isJobSeeker = profile?.role_mode === "job_seeker";
  const isRecruiter = profile?.role_mode === "recruiter";

  useEffect(() => {
    if (isAuthLoading) {
      return;
    }

    if (!isLoggedIn || !supabase) {
      const resetId = window.setTimeout(() => {
        setProfile(null);
        setUserId(null);
        setHasApplied(false);
        setStatus(null);
      }, 0);

      return () => {
        window.clearTimeout(resetId);
      };
    }

    let isMounted = true;

    async function loadApplicationState() {
      setIsChecking(true);

      try {
        const { data: userData, error: userError } =
          await supabase!.auth.getUser();

        if (userError || !userData.user) {
          if (process.env.NODE_ENV === "development") {
            console.error("[apply] user lookup failed", userError);
          }

          if (isMounted) {
            setFieldErrors({
              submit: "Please log in again before applying.",
            });
          }

          return;
        }

        const profileResult = await getProfile(userData.user.id);

        if (!isMounted) {
          return;
        }

        setUserId(userData.user.id);
        setProfile(profileResult.profile);

        if (profileResult.profile?.role_mode !== "job_seeker") {
          return;
        }

        const { data, error } = await supabase!.rpc(
          "get_candidate_application_for_job_slug",
          {
            p_job_slug: slug,
          },
        );

        if (error) {
          if (process.env.NODE_ENV === "development") {
            console.error("[apply] duplicate lookup failed", error);
          }

          if (isMounted) {
            setFieldErrors({
              submit:
                "We could not check your application status. Please try again.",
            });
          }

          return;
        }

        const lookup = normalizeApplicationLookup(
          data as CandidateApplicationLookup | CandidateApplicationLookup[],
        );

        if (isMounted) {
          setHasApplied(lookup.hasApplied);
          setStatus(lookup.status);
        }
      } finally {
        if (isMounted) {
          setIsChecking(false);
        }
      }
    }

    void loadApplicationState();

    return () => {
      isMounted = false;
    };
  }, [isAuthLoading, isLoggedIn, slug]);

  function handleResumeChange(event: ChangeEvent<HTMLInputElement>) {
    const nextFile = event.target.files?.[0] ?? null;
    const validation = validateApplicationResumeFile(nextFile);

    setResume(nextFile);
    setFieldErrors((current) => ({
      ...current,
      resume: validation.error ?? undefined,
      submit: undefined,
    }));
  }

  function handleAnswerChange(questionId: string, value: string) {
    setAnswers((current) => ({
      ...current,
      [questionId]: value,
    }));
    setFieldErrors((current) => ({
      ...current,
      answers: {
        ...current.answers,
        [questionId]: "",
      },
      submit: undefined,
    }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isSubmitting) {
      return;
    }

    const nextErrors: FieldErrors = {};
    const candidateId = userId;
    const resumeFile = resume;
    const supabaseClient = supabase;
    const resumeValidation = validateApplicationResumeFile(resume);

    if (!resumeValidation.valid) {
      nextErrors.resume = resumeValidation.error ?? undefined;
    } else if (resumeFile) {
      nextErrors.resume = await validateUploadFileSignature(
        resumeFile,
        "application/pdf",
      ) ?? undefined;
    }

    const missingAnswers = questions.reduce<Record<string, string>>(
      (errors, question) => {
        if (question.required && !answers[question.id]?.trim()) {
          errors[question.id] = "This answer is required.";
        }

        return errors;
      },
      {},
    );

    if (Object.keys(missingAnswers).length > 0) {
      nextErrors.answers = missingAnswers;
    }

    if (!supabaseClient) {
      nextErrors.submit =
        "Supabase is not configured. Please check your environment variables.";
    } else if (!isLoggedIn || !candidateId) {
      nextErrors.submit = "Please log in before applying.";
    } else if (!isJobSeeker) {
      nextErrors.submit = "Only Job Seeker accounts can apply to jobs.";
    } else if (hasApplied) {
      nextErrors.submit = "You have already applied to this job.";
    }

    if (
      nextErrors.resume ||
      nextErrors.submit ||
      Object.keys(nextErrors.answers ?? {}).length > 0 ||
      !resumeFile ||
      !candidateId ||
      !supabaseClient
    ) {
      setFieldErrors(nextErrors);
      return;
    }

    setFieldErrors({});
    setIsSubmitting(true);

    const resumePath = createResumePath(candidateId, slug);

    try {
      const { error: uploadError } = await supabaseClient.storage
        .from(applicationResumeBucket)
        .upload(resumePath, resumeFile, {
          cacheControl: "3600",
          contentType: "application/pdf",
          upsert: false,
        });

      if (uploadError) {
        if (process.env.NODE_ENV === "development") {
          console.error("[apply] resume upload failed", uploadError);
        }

        const friendlyError = getFriendlyUploadError(uploadError);
        setFieldErrors({ resume: friendlyError });
        showErrorToast(friendlyError);
        return;
      }

      const { error } = await supabaseClient.rpc("apply_to_published_job", {
        p_answers: answers,
        p_cover_letter: coverLetter.trim(),
        p_job_slug: slug,
        p_resume_path: resumePath,
      });

      if (error) {
        if (process.env.NODE_ENV === "development") {
          console.error("[apply] application submit failed", error);
        }

        await supabaseClient.storage
          .from(applicationResumeBucket)
          .remove([resumePath]);

        const friendlyError = getFriendlyApplyError(error);
        setFieldErrors({ submit: friendlyError });
        showErrorToast(friendlyError);
        return;
      }

      setHasApplied(true);
      setStatus("applied");
      showSuccessToast("Application submitted successfully.");
      router.push("/applications");
    } catch (error) {
      if (process.env.NODE_ENV === "development") {
        console.error("[apply] submit network failure", error);
      }

      const friendlyError = getFriendlyApplyError(error);
      setFieldErrors({ submit: friendlyError });
      showErrorToast(friendlyError);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <aside className="h-fit rounded-2xl border border-gray-200 bg-white p-5 shadow-[0_16px_45px_rgba(17,24,39,0.05)]">
      <h2 className="text-lg font-bold tracking-tight text-gray-900">
        Apply for this job
      </h2>
      <p className="mt-2 text-sm leading-6 text-gray-500">
        Submit your resume for {title} at {companyName}.
      </p>

      {isAuthLoading || isChecking ? (
        <div className="mt-5 h-11 animate-pulse rounded-xl bg-gray-100" />
      ) : null}

      {!isAuthLoading && !isChecking && !isLoggedIn ? (
        <Link
          href={loginHref}
          className="mt-5 inline-flex h-11 w-full items-center justify-center rounded-xl bg-black px-5 text-sm font-semibold text-white transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_0_0_4px_rgba(234,179,8,0.16),0_14px_30px_rgba(17,24,39,0.16)] focus:outline-none focus:ring-4 focus:ring-yellow-200"
        >
          Apply Now
        </Link>
      ) : null}

      {!isAuthLoading && !isChecking && isRecruiter ? (
        <div className="mt-5 rounded-xl border border-gray-200 bg-gray-50 p-4">
          <p className="text-sm font-semibold text-gray-900">
            Recruiter accounts cannot apply to jobs.
          </p>
          <p className="mt-2 text-sm leading-6 text-gray-500">
            Switch to Job Seeker from your account menu if you want to apply.
          </p>
        </div>
      ) : null}

      {!isAuthLoading &&
      !isChecking &&
      isLoggedIn &&
      !isRecruiter &&
      !isJobSeeker ? (
        <div className="mt-5 rounded-xl border border-gray-200 bg-gray-50 p-4">
          <p className="text-sm font-semibold text-gray-900">
            Complete onboarding before applying.
          </p>
          <Link
            href="/onboarding"
            className="mt-3 inline-flex h-10 items-center justify-center rounded-xl bg-black px-4 text-sm font-semibold text-white transition-all duration-200 hover:-translate-y-0.5 focus:outline-none focus:ring-4 focus:ring-yellow-200"
          >
            Continue
          </Link>
        </div>
      ) : null}

      {!isAuthLoading && !isChecking && isJobSeeker && hasApplied ? (
        <div className="mt-5 rounded-xl border border-yellow-200 bg-yellow-50 p-4">
          <p className="text-sm font-bold text-gray-900">Already Applied</p>
          <p className="mt-2 text-sm leading-6 text-gray-600">
            Status: {getApplicationStatusDisplay(status).label}
          </p>
          <Link
            href="/applications"
            className="mt-3 inline-flex h-10 items-center justify-center rounded-xl border border-gray-200 bg-white px-4 text-sm font-semibold text-gray-900 transition-all duration-200 hover:border-yellow-300 hover:bg-yellow-50/60 focus:outline-none focus:ring-4 focus:ring-yellow-200"
          >
            View My Applications
          </Link>
        </div>
      ) : null}

      {!isAuthLoading && !isChecking && isJobSeeker && !hasApplied ? (
        <form className="mt-5 grid gap-4" onSubmit={handleSubmit}>
          <label className="grid gap-2">
            <span className="text-xs font-bold uppercase tracking-[0.14em] text-gray-500">
              Resume PDF
            </span>
            <input
              accept="application/pdf,.pdf"
              className="block w-full rounded-xl border border-gray-200 bg-white px-3 py-3 text-sm font-semibold text-gray-900 file:mr-3 file:rounded-lg file:border-0 file:bg-gray-900 file:px-3 file:py-2 file:text-xs file:font-bold file:text-white focus:outline-none focus:ring-4 focus:ring-yellow-200"
              disabled={isSubmitting}
              onChange={handleResumeChange}
              type="file"
            />
            <span className="text-xs font-medium text-gray-500">
              PDF only, up to {applicationResumeMaxSizeLabel}.
            </span>
            {fieldErrors.resume ? (
              <span className="text-sm font-medium text-red-600">
                {fieldErrors.resume}
              </span>
            ) : null}
          </label>

          <label className="grid gap-2">
            <span className="text-xs font-bold uppercase tracking-[0.14em] text-gray-500">
              Cover Letter
            </span>
            <textarea
              className="min-h-32 rounded-xl border border-gray-200 bg-white px-3 py-3 text-sm font-medium leading-6 text-gray-900 outline-none transition-colors duration-200 placeholder:text-gray-400 focus:border-yellow-400 focus:ring-4 focus:ring-yellow-100"
              disabled={isSubmitting}
              maxLength={12000}
              onChange={(event) => {
                setCoverLetter(event.target.value);
                setFieldErrors((current) => ({
                  ...current,
                  submit: undefined,
                }));
              }}
              placeholder="Optional note for the recruiter"
              value={coverLetter}
            />
          </label>

          {questions.length > 0 ? (
            <div className="grid gap-4">
              {questions.map((question) => (
                <label className="grid gap-2" key={question.id}>
                  <span className="text-xs font-bold uppercase tracking-[0.14em] text-gray-500">
                    {question.label}
                  </span>
                  <textarea
                    className="min-h-24 rounded-xl border border-gray-200 bg-white px-3 py-3 text-sm font-medium leading-6 text-gray-900 outline-none transition-colors duration-200 placeholder:text-gray-400 focus:border-yellow-400 focus:ring-4 focus:ring-yellow-100"
                    disabled={isSubmitting}
                    onChange={(event) =>
                      handleAnswerChange(question.id, event.target.value)
                    }
                    value={answers[question.id] ?? ""}
                  />
                  {fieldErrors.answers?.[question.id] ? (
                    <span className="text-sm font-medium text-red-600">
                      {fieldErrors.answers[question.id]}
                    </span>
                  ) : null}
                </label>
              ))}
            </div>
          ) : null}

          {fieldErrors.submit ? (
            <p className="text-sm font-medium text-red-600">
              {fieldErrors.submit}
            </p>
          ) : null}

          <button
            className="inline-flex h-11 w-full items-center justify-center rounded-xl bg-black px-5 text-sm font-semibold text-white transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_0_0_4px_rgba(234,179,8,0.16),0_14px_30px_rgba(17,24,39,0.16)] focus:outline-none focus:ring-4 focus:ring-yellow-200 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isSubmitting}
            type="submit"
          >
            {isSubmitting ? "Submitting..." : "Apply Now"}
          </button>
        </form>
      ) : null}

      {applicationsCount > 0 ? (
        <p className="mt-4 text-xs font-semibold text-gray-500">
          {applicationsCount} applications recorded
        </p>
      ) : null}
    </aside>
  );
}
