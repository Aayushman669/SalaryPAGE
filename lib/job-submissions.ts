import {
  CONNECTION_ERROR_MESSAGE,
  isNetworkError,
  logAuthError,
} from "@/lib/auth-errors";
import type { JobSubmitPayload } from "@/lib/job-form";
import { notifyPublicJobChanged } from "@/lib/public-cache-client";
import { supabase } from "@/lib/supabase";

type JobMutationRow = {
  id: string;
  status: string | null;
  updated_at: string | null;
};

type SaveJobSubmissionResult = {
  error: string | null;
  job: JobMutationRow | null;
};

function readErrorText(error: unknown) {
  if (!error || typeof error !== "object") {
    return "";
  }

  const errorRecord = error as {
    code?: unknown;
    details?: unknown;
    hint?: unknown;
    message?: unknown;
  };

  return [
    errorRecord.code,
    errorRecord.details,
    errorRecord.hint,
    errorRecord.message,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function getFriendlyJobSaveError(error: unknown) {
  if (isNetworkError(error)) {
    return CONNECTION_ERROR_MESSAGE;
  }

  const errorText = readErrorText(error);

  if (
    errorText.includes("permission denied") ||
    errorText.includes("row-level security") ||
    errorText.includes("rls") ||
    errorText.includes("violates row-level security")
  ) {
    return "You do not have permission to save this job. Please make sure you are using a Recruiter account.";
  }

  if (
    errorText.includes("does not exist") ||
    errorText.includes("column") ||
    errorText.includes("relation")
  ) {
    return "Jobs storage is not ready yet. Please run the latest jobs migration in Supabase.";
  }

  if (errorText.includes("duplicate") || errorText.includes("unique")) {
    return "We could not create a unique job record. Please try saving again.";
  }

  if (errorText.includes("rate_limit_exceeded")) {
    return "You have created too many jobs recently. Please wait before trying again.";
  }

  if (errorText.includes("check constraint")) {
    return "Some job details need attention before this can be saved.";
  }

  return "We could not save this job. Please try again.";
}

export async function saveJobSubmission({
  jobId,
  payload,
}: {
  jobId: string | null;
  payload: JobSubmitPayload;
}): Promise<SaveJobSubmissionResult> {
  if (!supabase) {
    return {
      error: "Supabase is not configured. Please check your environment variables.",
      job: null,
    };
  }

  try {
    if (jobId) {
      const { data, error } = await supabase
        .from("jobs")
        .update(payload)
        .eq("id", jobId)
        .eq("created_by", payload.created_by)
        .select("id, status, updated_at")
        .maybeSingle();

      if (error) {
        logAuthError("[jobs] update failed", error);

        return {
          error: getFriendlyJobSaveError(error),
          job: null,
        };
      }

      if (!data) {
        return {
          error: "We could not find this draft. Please save it as a new job.",
          job: null,
        };
      }

      void notifyPublicJobChanged(data.id);

      return {
        error: null,
        job: data as JobMutationRow,
      };
    }

    const { data, error } = await supabase
      .from("jobs")
      .insert(payload)
      .select("id, status, updated_at")
      .single();

    if (error) {
      logAuthError("[jobs] insert failed", error);

      return {
        error: getFriendlyJobSaveError(error),
        job: null,
      };
    }

    void notifyPublicJobChanged(data.id);

    return {
      error: null,
      job: data as JobMutationRow,
    };
  } catch (error) {
    logAuthError("[jobs] mutation network failure", error);

    return {
      error: getFriendlyJobSaveError(error),
      job: null,
    };
  }
}
