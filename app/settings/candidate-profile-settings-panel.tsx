"use client";

import { useEffect, useMemo, useState, type ChangeEvent } from "react";
import type { DashboardProfile } from "@/lib/dashboard-data";
import {
  calculateCandidateProfileCompletion,
  candidateProfilePhotoMaxBytes,
  candidateResumeMaxBytes,
  candidateWorkPreferenceOptions,
  createCandidateProfileForm,
  deleteCandidateAsset,
  getCandidateAssetUrl,
  getCandidateProfile,
  parseCandidateSkills,
  saveCandidateProfile,
  uploadCandidateAsset,
  validateCandidateProfile,
  type CandidateProfile,
  type CandidateProfileForm,
  type CandidateProfileValidationErrors,
} from "@/lib/candidate-profile";
import { showErrorToast, showSuccessToast } from "@/lib/toast";

const inputClassName =
  "h-11 w-full rounded-xl border border-[#e4e7f0] bg-white px-3.5 text-sm font-medium text-[#0b1430] outline-none transition-colors duration-200 placeholder:text-[#8a93b0] focus:border-[#a99aff] focus:ring-4 focus:ring-[#635bff]/10 disabled:bg-[#f8f9fc] disabled:text-[#5f6b85]";
const textareaClassName =
  "min-h-28 w-full resize-y rounded-xl border border-[#e4e7f0] bg-white px-3.5 py-3 text-sm font-medium leading-6 text-[#0b1430] outline-none transition-colors duration-200 placeholder:text-[#8a93b0] focus:border-[#a99aff] focus:ring-4 focus:ring-[#635bff]/10";

function FieldError({ message }: { message?: string }) {
  return message ? (
    <p className="text-xs font-medium text-red-600" role="alert">
      {message}
    </p>
  ) : null;
}

function FieldLabel({ children, htmlFor }: { children: string; htmlFor: string }) {
  return (
    <label className="text-sm font-semibold text-[#0b1430]" htmlFor={htmlFor}>
      {children}
    </label>
  );
}

function CandidateAssetPreview({
  alt,
  fallback,
  path,
}: {
  alt: string;
  fallback: string;
  path: string | null;
}) {
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    if (!path) {
      return () => {
        active = false;
      };
    }

    void getCandidateAssetUrl(path).then((url) => {
      if (active) {
        setSrc(url);
      }
    });

    return () => {
      active = false;
    };
  }, [path]);

  return path && src ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      alt={alt}
      className="h-full w-full object-cover"
      decoding="async"
      loading="lazy"
      onError={() => setSrc(null)}
      src={src}
    />
  ) : (
    <span aria-hidden="true" className="m-auto text-lg font-black text-[#8a93b0]">
      {fallback}
    </span>
  );
}

function formFromProfile(
  profile: DashboardProfile,
  candidateProfile: CandidateProfile | null,
) {
  return createCandidateProfileForm(profile, candidateProfile);
}

export default function CandidateProfileSettingsPanel({
  profile,
}: {
  profile: DashboardProfile;
}) {
  const [candidateProfile, setCandidateProfile] = useState<CandidateProfile | null>(null);
  const [form, setForm] = useState<CandidateProfileForm>(
    formFromProfile(profile, null),
  );
  const [errors, setErrors] = useState<CandidateProfileValidationErrors>({});
  const [errorMessage, setErrorMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadCandidateProfile() {
      if (profile.role_mode !== "job_seeker") {
        setIsLoading(false);
        return;
      }

      const result = await getCandidateProfile();

      if (!active) {
        return;
      }

      if (result.error) {
        setErrorMessage(result.error);
      }

      setCandidateProfile(result.candidateProfile);
      setForm(formFromProfile(profile, result.candidateProfile));
      setIsLoading(false);
    }

    void loadCandidateProfile();

    return () => {
      active = false;
    };
  }, [profile]);

  useEffect(() => {
    return () => {
      if (photoPreview) {
        URL.revokeObjectURL(photoPreview);
      }
    };
  }, [photoPreview]);

  const completion = useMemo(
    () => calculateCandidateProfileCompletion(form),
    [form],
  );

  function updateField<K extends keyof CandidateProfileForm>(
    field: K,
    value: CandidateProfileForm[K],
  ) {
    setForm((current) => ({ ...current, [field]: value }));
    setErrors((current) => {
      const next = { ...current };
      delete next[field];
      return next;
    });
    setErrorMessage("");
  }

  function handlePhotoChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;

    if (!file) {
      return;
    }

    if (
      !["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
      file.size > candidateProfilePhotoMaxBytes
    ) {
      setErrors((current) => ({
        ...current,
        assets: "Profile photo must be a JPG, PNG, or WebP image smaller than 5MB.",
      }));
      return;
    }

    setPhotoFile(file);
    setPhotoPreview((current) => {
      if (current) {
        URL.revokeObjectURL(current);
      }
      return URL.createObjectURL(file);
    });
    setErrors((current) => ({ ...current, assets: undefined }));
    setErrorMessage("");
  }

  function handleResumeChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;

    if (!file) {
      return;
    }

    if (file.type !== "application/pdf" || file.size > candidateResumeMaxBytes) {
      setErrors((current) => ({
        ...current,
        assets: "Resume must be a PDF smaller than 5MB.",
      }));
      return;
    }

    setResumeFile(file);
    setErrors((current) => ({ ...current, assets: undefined }));
    setErrorMessage("");
  }

  async function handleSave() {
    if (isSaving || profile.role_mode !== "job_seeker") {
      return;
    }

    const validation = validateCandidateProfile(form);
    setErrors(validation.errors);
    setErrorMessage("");

    if (!validation.valid) {
      showErrorToast("Candidate profile needs attention.", "Review the highlighted fields.");
      return;
    }

    setIsSaving(true);
    let nextForm = form;
    const uploadedPaths: string[] = [];

    if (photoFile) {
      const result = await uploadCandidateAsset({
        candidateId: profile.id,
        file: photoFile,
        kind: "photo",
      });

      if (result.error || !result.path) {
        setErrors({ assets: result.error ?? "Profile photo upload failed." });
        setErrorMessage(result.error ?? "Profile photo upload failed. Please try again.");
        setIsSaving(false);
        return;
      }

      uploadedPaths.push(result.path);
      nextForm = { ...nextForm, profilePhotoPath: result.path };
    }

    if (resumeFile) {
      const result = await uploadCandidateAsset({
        candidateId: profile.id,
        file: resumeFile,
        kind: "resume",
      });

      if (result.error || !result.path) {
        await Promise.all(uploadedPaths.map((path) => deleteCandidateAsset(path)));
        setErrors({ assets: result.error ?? "Resume upload failed." });
        setErrorMessage(result.error ?? "Resume upload failed. Please try again.");
        setIsSaving(false);
        return;
      }

      uploadedPaths.push(result.path);
      nextForm = { ...nextForm, resumePath: result.path };
    }

    const result = await saveCandidateProfile({
      form: nextForm,
    });

    if (result.error || !result.candidateProfile) {
      await Promise.all(uploadedPaths.map((path) => deleteCandidateAsset(path)));
      setErrorMessage(result.error ?? "We could not save your candidate profile.");
      showErrorToast(result.error ?? "We could not save your candidate profile.");
      setIsSaving(false);
      return;
    }

    const previousPaths: Array<string | null> = [
      candidateProfile?.profile_photo_path ?? null,
      candidateProfile?.resume_path ?? null,
    ];
    const nextPaths: Array<string | null> = [
      result.candidateProfile.profile_photo_path,
      result.candidateProfile.resume_path,
    ];
    await Promise.all(
      previousPaths
        .filter((path): path is string => Boolean(path) && !nextPaths.includes(path))
        .map((path) => deleteCandidateAsset(path)),
    );

    setCandidateProfile(result.candidateProfile);
    setForm(formFromProfile(profile, result.candidateProfile));
    setPhotoFile(null);
    setResumeFile(null);
    setErrorMessage("");
    setIsSaving(false);
    showSuccessToast("Candidate profile saved successfully.");
  }

  if (profile.role_mode !== "job_seeker") {
    return (
      <div className="rounded-xl border border-[#e4e7f0] bg-[#f8f9fc] px-5 py-6">
        <p className="text-sm font-bold text-[#0b1430]">Candidate profile</p>
        <p className="mt-2 text-sm leading-6 text-[#5f6b85]">
          Candidate profiles are available for Job Seeker accounts. Switch roles from your account menu to manage one.
        </p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div aria-busy="true" className="animate-pulse space-y-4" role="status">
        <div className="h-24 rounded-xl bg-[#f3f4fa]" />
        <div className="h-11 rounded-xl bg-[#f3f4fa]" />
        <div className="h-32 rounded-xl bg-[#f3f4fa]" />
      </div>
    );
  }

  return (
    <div className="grid gap-5">
      <div className="flex flex-col gap-4 rounded-xl border border-[#e4e7f0] bg-[#f8f9fc] px-5 py-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-bold text-[#0b1430]">Candidate profile</p>
          <p className="mt-1 text-sm leading-6 text-[#5f6b85]">
            Keep your professional profile ready for applications and recruiter review.
          </p>
        </div>
        <div className="min-w-44">
          <div className="flex items-center justify-between text-xs font-bold text-[#5f6b85]">
            <span>Profile completion</span>
            <span>{completion}%</span>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-[#e4e7f0]">
            <div className="h-full rounded-full bg-[#635bff] transition-all" style={{ width: `${completion}%` }} />
          </div>
        </div>
      </div>

      {errorMessage ? (
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700" role="alert">
          {errorMessage}
        </p>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2 sm:col-span-2">
          <FieldLabel htmlFor="candidate-full-name">Full name</FieldLabel>
          <input id="candidate-full-name" className={inputClassName} maxLength={120} onChange={(event) => updateField("fullName", event.target.value)} value={form.fullName} />
          <FieldError message={errors.fullName} />
        </div>
        <div className="grid gap-2 sm:col-span-2">
          <FieldLabel htmlFor="candidate-email">Email</FieldLabel>
          <input id="candidate-email" className={`${inputClassName} cursor-not-allowed opacity-70`} disabled value={profile.email ?? "Email unavailable"} />
          <p className="text-xs text-[#5f6b85]">Your email comes from your authenticated account.</p>
        </div>
        <div className="grid gap-2 sm:col-span-2">
          <FieldLabel htmlFor="candidate-headline">Professional headline</FieldLabel>
          <input id="candidate-headline" className={inputClassName} maxLength={160} onChange={(event) => updateField("professionalHeadline", event.target.value)} placeholder="Frontend engineer focused on accessible products" value={form.professionalHeadline} />
          <FieldError message={errors.professionalHeadline} />
        </div>
        <div className="grid gap-2 sm:col-span-2">
          <FieldLabel htmlFor="candidate-about">About me</FieldLabel>
          <textarea id="candidate-about" className={textareaClassName} maxLength={8000} onChange={(event) => updateField("aboutMe", event.target.value)} placeholder="Tell recruiters what you build and what you are looking for." value={form.aboutMe} />
          <FieldError message={errors.aboutMe} />
        </div>
        <div className="grid gap-2 sm:col-span-2">
          <FieldLabel htmlFor="candidate-skills">Skills</FieldLabel>
          <textarea id="candidate-skills" className={textareaClassName} onChange={(event) => updateField("skillsText", event.target.value)} placeholder="React, TypeScript, SQL (one per line or comma separated)" value={form.skillsText} />
          <p className="text-xs text-[#5f6b85]">{parseCandidateSkills(form.skillsText).length} of 50 skills</p>
          <FieldError message={errors.skillsText} />
        </div>
        <div className="grid gap-2 sm:col-span-2">
          <FieldLabel htmlFor="candidate-experience">Experience</FieldLabel>
          <textarea id="candidate-experience" className={textareaClassName} maxLength={12000} onChange={(event) => updateField("experience", event.target.value)} placeholder="Summarize your relevant work experience." value={form.experience} />
          <FieldError message={errors.experience} />
        </div>
        <div className="grid gap-2 sm:col-span-2">
          <FieldLabel htmlFor="candidate-education">Education</FieldLabel>
          <textarea id="candidate-education" className={textareaClassName} maxLength={8000} onChange={(event) => updateField("education", event.target.value)} placeholder="Degrees, institutions, and relevant coursework." value={form.education} />
          <FieldError message={errors.education} />
        </div>
        <div className="grid gap-2">
          <FieldLabel htmlFor="candidate-location">Location</FieldLabel>
          <input id="candidate-location" className={inputClassName} maxLength={160} onChange={(event) => updateField("location", event.target.value)} placeholder="New Delhi, India" value={form.location} />
          <FieldError message={errors.location} />
        </div>
        <div className="grid gap-2">
          <FieldLabel htmlFor="candidate-years">Years of experience</FieldLabel>
          <input id="candidate-years" className={inputClassName} inputMode="numeric" max="100" min="0" onChange={(event) => updateField("yearsOfExperience", event.target.value)} type="number" value={form.yearsOfExperience} />
          <FieldError message={errors.yearsOfExperience} />
        </div>
        <div className="grid gap-2">
          <FieldLabel htmlFor="candidate-preferred-title">Preferred job title</FieldLabel>
          <input id="candidate-preferred-title" className={inputClassName} maxLength={160} onChange={(event) => updateField("preferredJobTitle", event.target.value)} value={form.preferredJobTitle} />
          <FieldError message={errors.preferredJobTitle} />
        </div>
        <div className="grid gap-2">
          <FieldLabel htmlFor="candidate-preferred-location">Preferred location</FieldLabel>
          <input id="candidate-preferred-location" className={inputClassName} maxLength={160} onChange={(event) => updateField("preferredLocation", event.target.value)} value={form.preferredLocation} />
          <FieldError message={errors.preferredLocation} />
        </div>
        <div className="grid gap-2 sm:col-span-2">
          <FieldLabel htmlFor="candidate-work-preference">Work preference</FieldLabel>
          <select id="candidate-work-preference" className={inputClassName} onChange={(event) => updateField("workPreference", event.target.value as CandidateProfileForm["workPreference"])} value={form.workPreference}>
            <option value="">Select preference</option>
            {candidateWorkPreferenceOptions.map((preference) => (
              <option key={preference} value={preference}>
                {preference === "on_site" ? "On-site" : preference[0].toUpperCase() + preference.slice(1)}
              </option>
            ))}
          </select>
          <FieldError message={errors.workPreference} />
        </div>
        <div className="grid gap-2">
          <FieldLabel htmlFor="candidate-portfolio">Portfolio URL</FieldLabel>
          <input id="candidate-portfolio" className={inputClassName} onChange={(event) => updateField("portfolioUrl", event.target.value)} placeholder="https://example.com" type="url" value={form.portfolioUrl} />
          <FieldError message={errors.portfolioUrl} />
        </div>
        <div className="grid gap-2">
          <FieldLabel htmlFor="candidate-linkedin">LinkedIn URL</FieldLabel>
          <input id="candidate-linkedin" className={inputClassName} onChange={(event) => updateField("linkedinUrl", event.target.value)} placeholder="https://linkedin.com/in/..." type="url" value={form.linkedinUrl} />
          <FieldError message={errors.linkedinUrl} />
        </div>
        <div className="grid gap-2 sm:col-span-2">
          <FieldLabel htmlFor="candidate-github">GitHub URL</FieldLabel>
          <input id="candidate-github" className={inputClassName} onChange={(event) => updateField("githubUrl", event.target.value)} placeholder="https://github.com/..." type="url" value={form.githubUrl} />
          <FieldError message={errors.githubUrl} />
        </div>
        <div className="grid gap-4 sm:col-span-2 sm:grid-cols-2">
          <label className="grid cursor-pointer gap-3 rounded-xl border border-dashed border-[#d8dcea] bg-[#f8f9fc] p-4 text-sm font-semibold text-[#0b1430]">
            <span>Profile photo <span className="font-normal text-[#5f6b85]">(JPG, PNG, WebP, up to 5MB)</span></span>
            <input accept="image/jpeg,image/png,image/webp" className="text-xs" onChange={handlePhotoChange} type="file" />
            <span className="flex h-20 w-20 overflow-hidden rounded-full border border-[#e4e7f0] bg-white">
              {photoPreview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img alt="Selected profile photo" className="h-full w-full object-cover" src={photoPreview} />
              ) : (
                <CandidateAssetPreview alt="Candidate profile photo" fallback={form.fullName.slice(0, 1).toUpperCase() || "C"} path={form.profilePhotoPath} />
              )}
            </span>
          </label>
          <label className="grid cursor-pointer gap-3 rounded-xl border border-dashed border-[#d8dcea] bg-[#f8f9fc] p-4 text-sm font-semibold text-[#0b1430]">
            <span>Resume <span className="font-normal text-[#5f6b85]">(PDF, up to 5MB)</span></span>
            <input accept="application/pdf,.pdf" className="text-xs" onChange={handleResumeChange} type="file" />
            <span className="text-sm font-medium text-[#5f6b85]">
              {resumeFile ? resumeFile.name : form.resumePath ? "Resume uploaded" : "No resume uploaded"}
            </span>
          </label>
        </div>
        <FieldError message={errors.assets} />
      </div>

      <div className="flex flex-col gap-3 border-t border-[#edf0f6] pt-5 sm:flex-row sm:items-center sm:justify-between">
        <button className="inline-flex h-11 items-center justify-center rounded-xl border border-[#e4e7f0] bg-white px-5 text-sm font-semibold text-[#0b1430] transition-colors hover:border-[#cfc8ff] hover:bg-[#f7f5ff] focus:outline-none focus:ring-4 focus:ring-[#635bff]/10" onClick={() => setIsPreviewing((current) => !current)} type="button">
          {isPreviewing ? "Close Preview" : "Preview Profile"}
        </button>
        <button className="inline-flex h-11 items-center justify-center rounded-xl bg-[#10162f] px-5 text-sm font-semibold text-white transition-colors hover:bg-[#1d2749] focus:outline-none focus:ring-4 focus:ring-[#635bff]/10 disabled:cursor-not-allowed disabled:opacity-60" disabled={isSaving} onClick={() => void handleSave()} type="button">
          {isSaving ? "Saving..." : "Save Profile"}
        </button>
      </div>

      {isPreviewing ? (
        <section aria-label="Candidate profile preview" className="rounded-2xl border border-[#ded9ff] bg-[#f7f5ff] p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
            <span className="flex h-16 w-16 shrink-0 overflow-hidden rounded-full border border-[#ded9ff] bg-white">
              {photoPreview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img alt="Profile preview" className="h-full w-full object-cover" src={photoPreview} />
              ) : (
                <CandidateAssetPreview alt="Profile preview" fallback={form.fullName.slice(0, 1).toUpperCase() || "C"} path={form.profilePhotoPath} />
              )}
            </span>
            <div className="min-w-0">
              <h3 className="break-words text-xl font-bold text-[#0b1430]">{form.fullName || "Your name"}</h3>
              <p className="mt-1 break-words text-sm font-semibold text-[#34406a]">{form.professionalHeadline || "Professional headline"}</p>
              <p className="mt-1 text-sm text-[#5f6b85]">{form.location || "Location not specified"}</p>
            </div>
          </div>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <div>
              <h4 className="text-xs font-bold uppercase tracking-[0.14em] text-[#5f6b85]">About</h4>
              <p className="mt-2 whitespace-pre-line break-words text-sm leading-6 text-[#34406a]">{form.aboutMe || "Add an introduction to help recruiters understand your background."}</p>
            </div>
            <div>
              <h4 className="text-xs font-bold uppercase tracking-[0.14em] text-[#5f6b85]">Skills</h4>
              <div className="mt-2 flex flex-wrap gap-2">
                {parseCandidateSkills(form.skillsText).length > 0 ? parseCandidateSkills(form.skillsText).map((skill) => <span className="rounded-full border border-[#ded9ff] bg-white px-2.5 py-1 text-xs font-semibold text-[#34406a]" key={skill}>{skill}</span>) : <span className="text-sm text-[#5f6b85]">Add your key skills.</span>}
              </div>
            </div>
          </div>
        </section>
      ) : null}
    </div>
  );
}
