import {
  CONNECTION_ERROR_MESSAGE,
  isNetworkError,
  isValidEmail,
  logAuthError,
} from "@/lib/auth-errors";
import { safeHttpUrl } from "@/lib/input-safety";
import { supabase } from "@/lib/supabase";
import { validateUploadFileSignature } from "@/lib/upload-validation";
import type { ProfileRow } from "@/lib/auth-profiles";

export const candidateWorkPreferenceOptions = [
  "remote",
  "hybrid",
  "on_site",
] as const;

export type CandidateWorkPreference =
  (typeof candidateWorkPreferenceOptions)[number];

export type CandidateProfile = {
  about_me: string | null;
  candidate_id: string;
  created_at: string;
  education: string | null;
  experience: string | null;
  github_url: string | null;
  linkedin_url: string | null;
  location: string | null;
  portfolio_url: string | null;
  preferred_job_title: string | null;
  preferred_location: string | null;
  profile_completion: number;
  profile_photo_path: string | null;
  professional_headline: string | null;
  resume_path: string | null;
  skills: string[];
  updated_at: string;
  work_preference: CandidateWorkPreference | null;
  years_of_experience: number | null;
};

export type CandidateProfileForm = {
  aboutMe: string;
  education: string;
  experience: string;
  fullName: string;
  githubUrl: string;
  linkedinUrl: string;
  location: string;
  portfolioUrl: string;
  preferredJobTitle: string;
  preferredLocation: string;
  professionalHeadline: string;
  profilePhotoPath: string | null;
  resumePath: string | null;
  skillsText: string;
  workPreference: CandidateWorkPreference | "";
  yearsOfExperience: string;
};

export type CandidateProfileValidationErrors = Partial<
  Record<keyof CandidateProfileForm | "assets", string>
>;

export type CandidateProfileValidationResult = {
  errors: CandidateProfileValidationErrors;
  valid: boolean;
};

export type RecruiterCandidateProfile = CandidateProfile;

export const candidateProfileAssetBucket = "candidate-profile-assets";
export const candidateProfilePhotoMaxBytes = 5 * 1024 * 1024;
export const candidateResumeMaxBytes = 5 * 1024 * 1024;

function cleanText(value: string | null | undefined) {
  return value?.trim() ?? "";
}

function normalizeOptional(value: string) {
  return cleanText(value) || null;
}

function isValidHttpUrl(value: string) {
  return safeHttpUrl(value) !== null;
}

function getFriendlyCandidateProfileError(error: unknown) {
  if (isNetworkError(error)) {
    return CONNECTION_ERROR_MESSAGE;
  }

  const message =
    error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();

  if (message.includes("authentication") || message.includes("jwt")) {
    return "Please sign in again to manage your candidate profile.";
  }

  if (message.includes("restricted")) {
    return "Your account is currently restricted from updating profile information.";
  }

  if (message.includes("duplicate") || message.includes("unique")) {
    return "This profile already exists. Refresh the page and try again.";
  }

  if (message.includes("relation") || message.includes("column") || message.includes("schema cache")) {
    return "Candidate profiles are not ready yet. Run the latest candidate profile migration in Supabase.";
  }

  if (message.includes("permission") || message.includes("row-level security")) {
    return "You do not have permission to update this candidate profile.";
  }

  return "We could not save your candidate profile. Please try again.";
}

export function createCandidateProfileForm(
  profile: Pick<ProfileRow, "full_name">,
  candidateProfile?: CandidateProfile | null,
): CandidateProfileForm {
  return {
    aboutMe: candidateProfile?.about_me ?? "",
    education: candidateProfile?.education ?? "",
    experience: candidateProfile?.experience ?? "",
    fullName: profile.full_name ?? "",
    githubUrl: candidateProfile?.github_url ?? "",
    linkedinUrl: candidateProfile?.linkedin_url ?? "",
    location: candidateProfile?.location ?? "",
    portfolioUrl: candidateProfile?.portfolio_url ?? "",
    preferredJobTitle: candidateProfile?.preferred_job_title ?? "",
    preferredLocation: candidateProfile?.preferred_location ?? "",
    professionalHeadline: candidateProfile?.professional_headline ?? "",
    profilePhotoPath: candidateProfile?.profile_photo_path ?? null,
    resumePath: candidateProfile?.resume_path ?? null,
    skillsText: candidateProfile?.skills.join("\n") ?? "",
    workPreference: candidateProfile?.work_preference ?? "",
    yearsOfExperience:
      candidateProfile?.years_of_experience === null ||
      candidateProfile?.years_of_experience === undefined
        ? ""
        : String(candidateProfile.years_of_experience),
  };
}

export function parseCandidateSkills(value: string) {
  return Array.from(
    new Set(
      value
        .split(/[\n,]/)
        .map((skill) => cleanText(skill))
        .filter(Boolean),
    ),
  ).slice(0, 50);
}

export function calculateCandidateProfileCompletion(form: CandidateProfileForm) {
  const checks = [
    Boolean(cleanText(form.fullName)),
    Boolean(cleanText(form.professionalHeadline)),
    Boolean(cleanText(form.aboutMe)),
    parseCandidateSkills(form.skillsText).length > 0,
    Boolean(cleanText(form.experience)),
    Boolean(cleanText(form.education)),
    Boolean(cleanText(form.location)),
    Boolean(
      cleanText(form.portfolioUrl) ||
        cleanText(form.linkedinUrl) ||
        cleanText(form.githubUrl),
    ),
    Boolean(form.profilePhotoPath),
    Boolean(form.resumePath),
    Boolean(cleanText(form.preferredJobTitle)),
    Boolean(cleanText(form.preferredLocation)),
    Boolean(form.workPreference),
    form.yearsOfExperience !== "",
  ];

  return Math.round((checks.filter(Boolean).length / checks.length) * 100);
}

function validateOptionalUrl(
  value: string,
  label: string,
  errors: CandidateProfileValidationErrors,
  field: keyof CandidateProfileForm,
) {
  if (value && !isValidHttpUrl(value)) {
    errors[field] = `${label} must be a valid http or https URL.`;
  }
}

export function validateCandidateProfile(
  form: CandidateProfileForm,
): CandidateProfileValidationResult {
  const errors: CandidateProfileValidationErrors = {};
  const fullName = cleanText(form.fullName);
  const years = form.yearsOfExperience === "" ? null : Number(form.yearsOfExperience);

  if (fullName.length < 2 || fullName.length > 120) {
    errors.fullName = "Full name must be between 2 and 120 characters.";
  }

  if (cleanText(form.professionalHeadline).length > 160) {
    errors.professionalHeadline = "Professional headline must be 160 characters or fewer.";
  }

  if (cleanText(form.aboutMe).length > 8000) {
    errors.aboutMe = "About me must be 8,000 characters or fewer.";
  }

  if (cleanText(form.experience).length > 12000) {
    errors.experience = "Experience must be 12,000 characters or fewer.";
  }

  if (cleanText(form.education).length > 8000) {
    errors.education = "Education must be 8,000 characters or fewer.";
  }

  if (cleanText(form.location).length > 160) {
    errors.location = "Location must be 160 characters or fewer.";
  }

  if (cleanText(form.preferredJobTitle).length > 160) {
    errors.preferredJobTitle = "Preferred job title must be 160 characters or fewer.";
  }

  if (cleanText(form.preferredLocation).length > 160) {
    errors.preferredLocation = "Preferred location must be 160 characters or fewer.";
  }

  if (parseCandidateSkills(form.skillsText).length > 50) {
    errors.skillsText = "Add up to 50 skills.";
  }

  validateOptionalUrl(form.portfolioUrl, "Portfolio URL", errors, "portfolioUrl");
  validateOptionalUrl(form.linkedinUrl, "LinkedIn URL", errors, "linkedinUrl");
  validateOptionalUrl(form.githubUrl, "GitHub URL", errors, "githubUrl");

  if (
    form.workPreference &&
    !candidateWorkPreferenceOptions.includes(form.workPreference)
  ) {
    errors.workPreference = "Choose a valid work preference.";
  }

  if (
    form.yearsOfExperience !== "" &&
    (!Number.isInteger(years) || years! < 0 || years! > 100)
  ) {
    errors.yearsOfExperience = "Years of experience must be between 0 and 100.";
  }

  if (!supabase) {
    errors.assets = "Supabase is not configured. Please check your environment variables.";
  }

  return { errors, valid: Object.keys(errors).length === 0 };
}

function mapCandidateProfileRow(row: unknown): CandidateProfile | null {
  if (!row || typeof row !== "object") {
    return null;
  }

  const value = row as Record<string, unknown>;
  const candidateId = typeof value.candidate_id === "string" ? value.candidate_id : "";

  if (!candidateId) {
    return null;
  }

  return {
    about_me: typeof value.about_me === "string" ? value.about_me : null,
    candidate_id: candidateId,
    created_at: typeof value.created_at === "string" ? value.created_at : "",
    education: typeof value.education === "string" ? value.education : null,
    experience: typeof value.experience === "string" ? value.experience : null,
    github_url: typeof value.github_url === "string" ? value.github_url : null,
    linkedin_url: typeof value.linkedin_url === "string" ? value.linkedin_url : null,
    location: typeof value.location === "string" ? value.location : null,
    portfolio_url: typeof value.portfolio_url === "string" ? value.portfolio_url : null,
    preferred_job_title:
      typeof value.preferred_job_title === "string" ? value.preferred_job_title : null,
    preferred_location:
      typeof value.preferred_location === "string" ? value.preferred_location : null,
    profile_completion:
      typeof value.profile_completion === "number" ? value.profile_completion : 0,
    profile_photo_path:
      typeof value.profile_photo_path === "string" ? value.profile_photo_path : null,
    professional_headline:
      typeof value.professional_headline === "string"
        ? value.professional_headline
        : null,
    resume_path: typeof value.resume_path === "string" ? value.resume_path : null,
    skills: Array.isArray(value.skills)
      ? value.skills.filter((skill): skill is string => typeof skill === "string")
      : [],
    updated_at: typeof value.updated_at === "string" ? value.updated_at : "",
    work_preference:
      typeof value.work_preference === "string" &&
      candidateWorkPreferenceOptions.includes(
        value.work_preference as CandidateWorkPreference,
      )
        ? (value.work_preference as CandidateWorkPreference)
        : null,
    years_of_experience:
      typeof value.years_of_experience === "number"
        ? value.years_of_experience
        : null,
  };
}

export async function getCandidateProfile() {
  if (!supabase) {
    return { candidateProfile: null, error: "Supabase is not configured." };
  }

  try {
    const { data, error } = await supabase.rpc("get_candidate_profile");

    if (error) {
      logAuthError("[candidate-profile] fetch failed", error);
      return { candidateProfile: null, error: getFriendlyCandidateProfileError(error) };
    }

    return { candidateProfile: mapCandidateProfileRow(data), error: null };
  } catch (error) {
    logAuthError("[candidate-profile] fetch network failure", error);
    return { candidateProfile: null, error: getFriendlyCandidateProfileError(error) };
  }
}

export async function getRecruiterCandidateProfile(candidateId: string) {
  if (!supabase) {
    return { candidateProfile: null, error: "Supabase is not configured." };
  }

  try {
    const { data, error } = await supabase.rpc("get_recruiter_candidate_profile", {
      p_candidate_id: candidateId,
    });

    if (error) {
      logAuthError("[candidate-profile] recruiter fetch failed", error);
      return { candidateProfile: null, error: "Candidate profile details are unavailable." };
    }

    const row = Array.isArray(data) ? data[0] : data;
    return { candidateProfile: mapCandidateProfileRow(row), error: null };
  } catch (error) {
    logAuthError("[candidate-profile] recruiter fetch network failure", error);
    return { candidateProfile: null, error: "Candidate profile details are unavailable." };
  }
}

export async function saveCandidateProfile({
  form,
}: {
  form: CandidateProfileForm;
}) {
  if (!supabase) {
    return { candidateProfile: null, error: "Supabase is not configured." };
  }

  try {
    const { data, error } = await supabase.rpc("upsert_candidate_profile", {
      p_about_me: normalizeOptional(form.aboutMe),
      p_education: normalizeOptional(form.education),
      p_experience: normalizeOptional(form.experience),
      p_full_name: cleanText(form.fullName),
      p_github_url: normalizeOptional(form.githubUrl),
      p_linkedin_url: normalizeOptional(form.linkedinUrl),
      p_location: normalizeOptional(form.location),
      p_portfolio_url: normalizeOptional(form.portfolioUrl),
      p_preferred_job_title: normalizeOptional(form.preferredJobTitle),
      p_preferred_location: normalizeOptional(form.preferredLocation),
      p_professional_headline: normalizeOptional(form.professionalHeadline),
      p_profile_photo_path: form.profilePhotoPath,
      p_resume_path: form.resumePath,
      p_skills: parseCandidateSkills(form.skillsText),
      p_work_preference: form.workPreference || null,
      p_years_of_experience:
        form.yearsOfExperience === "" ? null : Number(form.yearsOfExperience),
    });

    if (error) {
      logAuthError("[candidate-profile] save failed", error);
      return { candidateProfile: null, error: getFriendlyCandidateProfileError(error) };
    }

    const row = Array.isArray(data) ? data[0] : data;
    if (!row) {
      return { candidateProfile: null, error: "We could not save your candidate profile." };
    }

    return { candidateProfile: mapCandidateProfileRow(row), error: null };
  } catch (error) {
    logAuthError("[candidate-profile] save network failure", error);
    return { candidateProfile: null, error: getFriendlyCandidateProfileError(error) };
  }
}

export async function uploadCandidateAsset({
  candidateId,
  file,
  kind,
}: {
  candidateId: string;
  file: File;
  kind: "photo" | "resume";
}) {
  if (!supabase) {
    return { error: "Supabase is not configured.", path: null };
  }

  const allowedTypes =
    kind === "resume"
      ? new Map([["application/pdf", "pdf"]])
      : new Map([
          ["image/jpeg", "jpg"],
          ["image/png", "png"],
          ["image/webp", "webp"],
        ]);
  const extension = allowedTypes.get(file.type);
  const maxBytes =
    kind === "resume" ? candidateResumeMaxBytes : candidateProfilePhotoMaxBytes;

  if (!extension || file.size <= 0 || file.size > maxBytes) {
    return {
      error:
        kind === "resume"
          ? "Resume must be a PDF smaller than 5MB."
          : "Profile photo must be a JPG, PNG, or WebP image smaller than 5MB.",
      path: null,
    };
  }

  const signatureError = await validateUploadFileSignature(file, file.type as
    "application/pdf" | "image/jpeg" | "image/png" | "image/webp");

  if (signatureError) {
    return { error: signatureError, path: null };
  }

  const path = `${candidateId}/${kind}/${globalThis.crypto.randomUUID()}.${extension}`;

  try {
    const { error } = await supabase.storage
      .from(candidateProfileAssetBucket)
      .upload(path, file, {
        cacheControl: "3600",
        contentType: file.type,
        upsert: false,
      });

    if (error) {
      logAuthError(`[candidate-profile] ${kind} upload failed`, error);
      return { error: getFriendlyCandidateProfileError(error), path: null };
    }

    return { error: null, path };
  } catch (error) {
    logAuthError(`[candidate-profile] ${kind} upload network failure`, error);
    return { error: getFriendlyCandidateProfileError(error), path: null };
  }
}

export async function deleteCandidateAsset(path: string | null) {
  if (!supabase || !path) {
    return null;
  }

  const { error } = await supabase.storage
    .from(candidateProfileAssetBucket)
    .remove([path]);

  if (error) {
    logAuthError("[candidate-profile] asset cleanup failed", error);
  }

  return error ? "We saved your profile, but could not remove the previous file." : null;
}

export async function getCandidateAssetUrl(path: string | null, download = false) {
  if (!supabase || !path) {
    return null;
  }

  const { data, error } = await supabase.storage
    .from(candidateProfileAssetBucket)
    .createSignedUrl(path, 600, download ? { download: true } : undefined);

  if (error || !data?.signedUrl) {
    if (error) {
      logAuthError("[candidate-profile] signed asset URL failed", error);
    }
    return null;
  }

  return data.signedUrl;
}

export function isValidCandidateEmail(value: string) {
  return isValidEmail(value);
}
