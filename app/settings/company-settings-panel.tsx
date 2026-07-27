"use client";

import { useEffect, useMemo, useState, type ChangeEvent } from "react";
import Link from "next/link";
import ApplicationConfirmationDialog from "@/app/applications/application-confirmation-dialog";
import type { DashboardProfile } from "@/lib/dashboard-data";
import {
  calculateCompanyProfileCompletion,
  companyHiringStatusOptions,
  companySizeOptions,
  companyWorkModelOptions,
  createCompanyForm,
  deleteCompanyAsset,
  deleteCompanyGalleryImage,
  getCompanyGallery,
  getCompanyProfile,
  getCompanyAssetUrl,
  getCompanyStats,
  replaceCompanyGalleryImage,
  saveCompanyProfile,
  slugifyCompanyName,
  uploadCompanyAsset,
  uploadCompanyGalleryImage,
  validateCompanyImageFile,
  type CompanyGalleryItem,
  validateCompanyProfile,
  type CompanyStats,
  type CompanyProfile,
  type CompanyProfileForm,
  type CompanyValidationErrors,
} from "@/lib/company-profile";
import { showErrorToast, showSuccessToast } from "@/lib/toast";
import { notifyPublicCompanyChanged } from "@/lib/public-cache-client";

const inputClassName =
  "h-11 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm font-medium text-gray-900 outline-none transition-all duration-200 placeholder:text-gray-400 focus:border-yellow-400 focus:ring-4 focus:ring-yellow-100 dark:bg-white/5";
const textareaClassName =
  "min-h-28 w-full resize-y rounded-xl border border-gray-200 bg-white px-3 py-3 text-sm font-medium leading-6 text-gray-900 outline-none transition-all duration-200 placeholder:text-gray-400 focus:border-yellow-400 focus:ring-4 focus:ring-yellow-100 dark:bg-white/5";

function FieldError({ message }: { message?: string }) {
  return message ? <p className="text-xs font-medium text-red-600">{message}</p> : null;
}

function FieldLabel({ children, htmlFor }: { children: string; htmlFor: string }) {
  return (
    <label className="text-sm font-semibold text-gray-900" htmlFor={htmlFor}>
      {children}
    </label>
  );
}

function AssetPreview({
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

    void getCompanyAssetUrl(path).then((url) => {
      if (active) {
        setSrc(url);
      }
    });

    return () => {
      active = false;
    };
  }, [path]);

  const visibleSrc = path ? src : null;

  return visibleSrc ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      alt={alt}
      className="h-full w-full object-cover"
      decoding="async"
      loading="lazy"
      onError={() => setSrc(null)}
      src={visibleSrc}
    />
  ) : (
    <span aria-hidden="true" className="text-lg font-black text-gray-400">
      {fallback}
    </span>
  );
}

function formFromCompany(company: CompanyProfile | null) {
  return createCompanyForm(company);
}

export default function CompanySettingsPanel({
  profile,
}: {
  profile: DashboardProfile;
}) {
  const [company, setCompany] = useState<CompanyProfile | null>(null);
  const [form, setForm] = useState<CompanyProfileForm>(createCompanyForm());
  const [errors, setErrors] = useState<CompanyValidationErrors>({});
  const [errorMessage, setErrorMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [bannerFile, setBannerFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [bannerPreview, setBannerPreview] = useState<string | null>(null);
  const [gallery, setGallery] = useState<CompanyGalleryItem[]>([]);
  const [galleryFile, setGalleryFile] = useState<File | null>(null);
  const [galleryPreview, setGalleryPreview] = useState<string | null>(null);
  const [galleryAltText, setGalleryAltText] = useState("");
  const [galleryError, setGalleryError] = useState("");
  const [isGalleryLoading, setIsGalleryLoading] = useState(false);
  const [isStatsLoading, setIsStatsLoading] = useState(false);
  const [isGallerySaving, setIsGallerySaving] = useState(false);
  const [replacingGalleryId, setReplacingGalleryId] = useState<string | null>(null);
  const [pendingGalleryDelete, setPendingGalleryDelete] = useState<CompanyGalleryItem | null>(null);
  const [companyStats, setCompanyStats] = useState<CompanyStats>({ activeJobs: 0, totalApplications: 0, totalJobs: 0 });
  const [statsError, setStatsError] = useState("");

  useEffect(() => {
    let active = true;

    async function loadCompany() {
      if (profile.role_mode !== "recruiter") {
        setIsLoading(false);
        return;
      }

      const result = await getCompanyProfile(profile.id);

      if (!active) {
        return;
      }

      if (result.error) {
        setErrorMessage(result.error);
      }

      setCompany(result.company);
      setForm(formFromCompany(result.company));
      if (result.company) {
        setIsGalleryLoading(true);
        setIsStatsLoading(true);
        const [galleryResult, statsResult] = await Promise.all([
          getCompanyGallery(result.company.id),
          getCompanyStats(profile.id),
        ]);
        if (!active) {
          return;
        }
        setGallery(galleryResult.gallery);
        setGalleryError(galleryResult.error ?? "");
        setCompanyStats(statsResult.stats);
        setStatsError(statsResult.error ?? "");
        setIsGalleryLoading(false);
        setIsStatsLoading(false);
      } else {
        setGallery([]);
        setCompanyStats({ activeJobs: 0, totalApplications: 0, totalJobs: 0 });
        setIsGalleryLoading(false);
        setIsStatsLoading(false);
      }
      setIsLoading(false);
    }

    void loadCompany();

    return () => {
      active = false;
    };
  }, [profile.id, profile.role_mode]);

  useEffect(() => {
    return () => {
      if (logoPreview) URL.revokeObjectURL(logoPreview);
      if (bannerPreview) URL.revokeObjectURL(bannerPreview);
      if (galleryPreview) URL.revokeObjectURL(galleryPreview);
    };
  }, [bannerPreview, galleryPreview, logoPreview]);

  const completion = useMemo(() => calculateCompanyProfileCompletion(form), [form]);

  function updateField<K extends keyof CompanyProfileForm>(
    field: K,
    value: CompanyProfileForm[K],
  ) {
    setForm((current) => ({ ...current, [field]: value }));
    setErrors((current) => {
      const next = { ...current };
      delete next[field];
      return next;
    });
    setErrorMessage("");
  }

  function handleNameChange(event: ChangeEvent<HTMLInputElement>) {
    const value = event.target.value;
    setForm((current) => ({
      ...current,
      name: value,
      slug: current.slug ? current.slug : slugifyCompanyName(value),
    }));
    setErrors((current) => ({ ...current, name: undefined }));
    setErrorMessage("");
  }

  function handleAssetChange(
    event: ChangeEvent<HTMLInputElement>,
    kind: "logo" | "banner",
  ) {
    const file = event.target.files?.[0] ?? null;

    if (!file) {
      return;
    }

    const validation = validateCompanyImageFile(file, kind);

    if (validation.error) {
      setErrors((current) => ({
        ...current,
        assets: validation.error,
      }));
      return;
    }

    const previewUrl = URL.createObjectURL(file);

    if (kind === "logo") {
      setLogoFile(file);
      setLogoPreview(previewUrl);
    } else {
      setBannerFile(file);
      setBannerPreview(previewUrl);
    }

    setErrors((current) => ({ ...current, assets: undefined }));
    setErrorMessage("");
  }

  function removeAsset(kind: "logo" | "banner") {
    updateField(kind === "logo" ? "logoPath" : "bannerPath", null);
    if (kind === "logo") {
      setLogoFile(null);
      setLogoPreview(null);
    } else {
      setBannerFile(null);
      setBannerPreview(null);
    }
  }

  function handleGalleryFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    if (!file) return;
    const validation = validateCompanyImageFile(file, "gallery");
    if (validation.error) {
      setGalleryError(validation.error);
      return;
    }
    setGalleryFile(file);
    setGalleryPreview(URL.createObjectURL(file));
    setGalleryError("");
  }

  async function handleGalleryUpload() {
    if (!company || !galleryFile || isGallerySaving) return;
    setIsGallerySaving(true);
    const result = await uploadCompanyGalleryImage({
      altText: galleryAltText,
      companyId: company.id,
      file: galleryFile,
      recruiterId: profile.id,
    });
    setIsGallerySaving(false);
    if (result.error || !result.item) {
      setGalleryError(result.error ?? "Gallery image upload failed.");
      showErrorToast(result.error ?? "Gallery image upload failed.");
      return;
    }
    setGallery((current) => [result.item!, ...current]);
    setGalleryFile(null);
    setGalleryPreview(null);
    setGalleryAltText("");
    void notifyPublicCompanyChanged();
    showSuccessToast("Gallery image uploaded.");
  }

  async function handleGalleryReplace(event: ChangeEvent<HTMLInputElement>, item: CompanyGalleryItem) {
    const file = event.target.files?.[0] ?? null;
    if (!file || isGallerySaving) return;
    const validation = validateCompanyImageFile(file, "gallery");
    if (validation.error) {
      setGalleryError(validation.error);
      return;
    }
    setReplacingGalleryId(item.id);
    setIsGallerySaving(true);
    const result = await replaceCompanyGalleryImage({
      altText: item.altText,
      file,
      item,
      recruiterId: profile.id,
    });
    setIsGallerySaving(false);
    setReplacingGalleryId(null);
    if (result.error || !result.item) {
      setGalleryError(result.error ?? "Gallery image replacement failed.");
      showErrorToast(result.error ?? "Gallery image replacement failed.");
      return;
    }
    setGallery((current) => current.map((entry) => entry.id === item.id ? result.item! : entry));
    setGalleryError("");
    void notifyPublicCompanyChanged();
    showSuccessToast("Gallery image replaced.");
  }

  function handleGalleryDelete(item: CompanyGalleryItem) {
    if (isGallerySaving) return;
    setPendingGalleryDelete(item);
  }

  async function confirmGalleryDelete() {
    if (!pendingGalleryDelete || isGallerySaving) return;
    setIsGallerySaving(true);
    const result = await deleteCompanyGalleryImage(pendingGalleryDelete);
    setIsGallerySaving(false);
    if (result.error) {
      setGalleryError(result.error);
      showErrorToast(result.error);
      return;
    }
    setGallery((current) => current.filter((entry) => entry.id !== pendingGalleryDelete.id));
    setPendingGalleryDelete(null);
    void notifyPublicCompanyChanged();
    showSuccessToast("Gallery image removed.");
  }

  async function handleSave() {
    if (isSaving || profile.role_mode !== "recruiter") {
      return;
    }

    const validation = validateCompanyProfile(form);
    setErrors(validation.errors);
    setErrorMessage("");

    if (!validation.valid) {
      showErrorToast("Company profile needs attention.", "Review the highlighted fields.");
      return;
    }

    setIsSaving(true);
    const previousLogoPath = form.logoPath;
    const previousBannerPath = form.bannerPath;
    let nextForm = form;

    if (logoFile) {
      const result = await uploadCompanyAsset({
        file: logoFile,
        kind: "logo",
        recruiterId: profile.id,
      });

      if (result.error || !result.path) {
        setErrorMessage(result.error ?? "Logo upload failed. Please try again.");
        setErrors({ assets: result.error ?? "Logo upload failed." });
        setIsSaving(false);
        return;
      }

      nextForm = { ...nextForm, logoPath: result.path };
    }

    if (bannerFile) {
      const result = await uploadCompanyAsset({
        file: bannerFile,
        kind: "banner",
        recruiterId: profile.id,
      });

      if (result.error || !result.path) {
        if (nextForm.logoPath && nextForm.logoPath !== previousLogoPath) {
          await deleteCompanyAsset(nextForm.logoPath);
        }
        setErrorMessage(result.error ?? "Banner upload failed. Please try again.");
        setErrors({ assets: result.error ?? "Banner upload failed." });
        setIsSaving(false);
        return;
      }

      nextForm = { ...nextForm, bannerPath: result.path };
    }

    const result = await saveCompanyProfile({
      companyId: company?.id ?? null,
      form: nextForm,
      recruiterId: profile.id,
    });

    setIsSaving(false);

    if (result.error || !result.company) {
      if (nextForm.logoPath && nextForm.logoPath !== previousLogoPath) {
        await deleteCompanyAsset(nextForm.logoPath);
      }
      if (nextForm.bannerPath && nextForm.bannerPath !== previousBannerPath) {
        await deleteCompanyAsset(nextForm.bannerPath);
      }
      setErrorMessage(result.error ?? "We could not save your company profile.");
      showErrorToast(result.error ?? "We could not save your company profile.");
      return;
    }

    setCompany(result.company);
    setForm(formFromCompany(result.company));
    if (previousLogoPath && previousLogoPath !== result.company.logo_path) {
      await deleteCompanyAsset(previousLogoPath);
    }
    if (previousBannerPath && previousBannerPath !== result.company.banner_path) {
      await deleteCompanyAsset(previousBannerPath);
    }
    setLogoFile(null);
    setBannerFile(null);
    setLogoPreview(null);
    setBannerPreview(null);
    void notifyPublicCompanyChanged();
    showSuccessToast("Company profile saved successfully.");
  }

  if (profile.role_mode !== "recruiter") {
    return (
      <div className="rounded-xl border border-gray-200 bg-gray-50 px-5 py-6 dark:bg-white/5">
        <p className="text-sm font-bold text-gray-900">Recruiter company profile</p>
        <p className="mt-2 text-sm leading-6 text-gray-500">
          Company profiles are available for Recruiter accounts. Switch roles from your account menu to manage one.
        </p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div aria-busy="true" className="animate-pulse space-y-4" role="status">
        <div className="h-12 rounded-xl bg-gray-100 dark:bg-white/10" />
        <div className="h-32 rounded-xl bg-gray-100 dark:bg-white/10" />
        <div className="h-12 w-40 rounded-xl bg-gray-100 dark:bg-white/10" />
      </div>
    );
  }

  return (
    <div className="grid gap-5">
      <div className="flex flex-col gap-4 rounded-xl border border-gray-200 bg-gray-50 px-5 py-5 dark:bg-white/5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-bold text-gray-900">Company profile</p>
          <p className="mt-1 text-sm leading-6 text-gray-500">
            Keep one trusted company identity for your future job listings and recruiter workspace.
          </p>
        </div>
        <div className="min-w-44">
          <div className="flex items-center justify-between text-xs font-bold text-gray-500">
            <span>Profile completion</span>
            <span>{completion}%</span>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-gray-200 dark:bg-white/10">
            <div className="h-full rounded-full bg-yellow-400 transition-all" style={{ width: `${completion}%` }} />
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
          <FieldLabel htmlFor="company-name">Company name</FieldLabel>
          <input id="company-name" value={form.name} onChange={handleNameChange} className={inputClassName} maxLength={140} />
          <FieldError message={errors.name} />
        </div>
        <div className="grid gap-2 sm:col-span-2">
          <FieldLabel htmlFor="company-slug">SEO slug</FieldLabel>
          <input id="company-slug" value={form.slug} onChange={(event) => updateField("slug", event.target.value)} className={inputClassName} maxLength={160} />
          <p className="text-xs text-gray-500">Used for your public company profile URL.</p>
          <FieldError message={errors.slug} />
        </div>
        <div className="grid gap-2 sm:col-span-2">
          <FieldLabel htmlFor="company-about">About company</FieldLabel>
          <textarea id="company-about" value={form.about} onChange={(event) => updateField("about", event.target.value)} className={textareaClassName} maxLength={8000} />
          <FieldError message={errors.about} />
        </div>
        <div className="grid gap-2 sm:col-span-2">
          <FieldLabel htmlFor="company-mission">Mission</FieldLabel>
          <textarea id="company-mission" value={form.mission} onChange={(event) => updateField("mission", event.target.value)} className={textareaClassName} maxLength={4000} placeholder="What your company is here to accomplish" />
          <FieldError message={errors.mission} />
        </div>
        <div className="grid gap-2 sm:col-span-2">
          <FieldLabel htmlFor="company-vision">Vision</FieldLabel>
          <textarea id="company-vision" value={form.vision} onChange={(event) => updateField("vision", event.target.value)} className={textareaClassName} maxLength={4000} placeholder="The future your company is building" />
          <FieldError message={errors.vision} />
        </div>
        <div className="grid gap-2 sm:col-span-2">
          <FieldLabel htmlFor="company-culture">Culture</FieldLabel>
          <textarea id="company-culture" value={form.culture} onChange={(event) => updateField("culture", event.target.value)} className={textareaClassName} maxLength={4000} placeholder="How your team works together" />
          <FieldError message={errors.culture} />
        </div>
        <div className="grid gap-2">
          <FieldLabel htmlFor="company-industry">Industry</FieldLabel>
          <input id="company-industry" value={form.industry} onChange={(event) => updateField("industry", event.target.value)} className={inputClassName} maxLength={120} />
          <FieldError message={errors.industry} />
        </div>
        <div className="grid gap-2">
          <FieldLabel htmlFor="company-size">Company size</FieldLabel>
          <select id="company-size" value={form.companySize} onChange={(event) => updateField("companySize", event.target.value as CompanyProfileForm["companySize"])} className={inputClassName}>
            <option value="">Select size</option>
            {companySizeOptions.map((size) => <option key={size} value={size}>{size} employees</option>)}
          </select>
          <FieldError message={errors.companySize} />
        </div>
        <div className="grid gap-2">
          <FieldLabel htmlFor="company-founded">Founded year</FieldLabel>
          <input id="company-founded" inputMode="numeric" value={form.foundedYear} onChange={(event) => updateField("foundedYear", event.target.value)} className={inputClassName} maxLength={4} placeholder="2020" />
          <FieldError message={errors.foundedYear} />
        </div>
        <div className="grid gap-2">
          <FieldLabel htmlFor="company-work-model">Work model</FieldLabel>
          <select id="company-work-model" value={form.workModel} onChange={(event) => updateField("workModel", event.target.value as CompanyProfileForm["workModel"])} className={inputClassName}>
            <option value="">Select model</option>
            {companyWorkModelOptions.map((model) => <option key={model} value={model}>{model === "on_site" ? "On-site" : model[0].toUpperCase() + model.slice(1)}</option>)}
          </select>
          <FieldError message={errors.workModel} />
        </div>
        <div className="grid gap-2 sm:col-span-2">
          <FieldLabel htmlFor="company-headquarters">Headquarters</FieldLabel>
          <input id="company-headquarters" value={form.headquarters} onChange={(event) => updateField("headquarters", event.target.value)} className={inputClassName} maxLength={140} placeholder="New Delhi, India" />
        </div>
        <div className="grid gap-2 sm:col-span-2">
          <FieldLabel htmlFor="company-address">Address</FieldLabel>
          <input id="company-address" value={form.address} onChange={(event) => updateField("address", event.target.value)} className={inputClassName} maxLength={240} placeholder="Street address, city, country" />
          <FieldError message={errors.address} />
        </div>
        <div className="grid gap-2 sm:col-span-2">
          <FieldLabel htmlFor="company-hiring-status">Hiring status</FieldLabel>
          <select id="company-hiring-status" value={form.hiringStatus} onChange={(event) => updateField("hiringStatus", event.target.value as CompanyProfileForm["hiringStatus"])} className={inputClassName}>
            {companyHiringStatusOptions.map((status) => <option key={status} value={status}>{status === "always_hiring" ? "Always hiring" : status === "not_hiring" ? "Not currently hiring" : "Currently hiring"}</option>)}
          </select>
          <FieldError message={errors.hiringStatus} />
        </div>
        <div className="grid gap-2">
          <FieldLabel htmlFor="company-email">Contact email</FieldLabel>
          <input id="company-email" type="email" value={form.contactEmail} onChange={(event) => updateField("contactEmail", event.target.value)} className={inputClassName} />
          <FieldError message={errors.contactEmail} />
        </div>
        <div className="grid gap-2">
          <FieldLabel htmlFor="company-phone">Contact phone</FieldLabel>
          <input id="company-phone" type="tel" value={form.contactPhone} onChange={(event) => updateField("contactPhone", event.target.value)} className={inputClassName} />
          <FieldError message={errors.contactPhone} />
        </div>
        <div className="grid gap-2 sm:col-span-2">
          <FieldLabel htmlFor="company-benefits">Company benefits</FieldLabel>
          <textarea id="company-benefits" value={form.benefits} onChange={(event) => updateField("benefits", event.target.value)} className={textareaClassName} placeholder="One benefit per line" />
        </div>
        <div className="grid gap-2 sm:col-span-2">
          <FieldLabel htmlFor="company-website">Website</FieldLabel>
          <input id="company-website" type="url" value={form.website} onChange={(event) => updateField("website", event.target.value)} className={inputClassName} placeholder="https://example.com" />
          <FieldError message={errors.website} />
        </div>
        <div className="grid gap-2">
          <FieldLabel htmlFor="company-linkedin">LinkedIn</FieldLabel>
          <input id="company-linkedin" type="url" value={form.linkedinUrl} onChange={(event) => updateField("linkedinUrl", event.target.value)} className={inputClassName} placeholder="https://linkedin.com/company/..." />
          <FieldError message={errors.linkedinUrl} />
        </div>
        <div className="grid gap-2">
          <FieldLabel htmlFor="company-x">X (Twitter)</FieldLabel>
          <input id="company-x" type="url" value={form.xUrl} onChange={(event) => updateField("xUrl", event.target.value)} className={inputClassName} />
          <FieldError message={errors.xUrl} />
        </div>
        <div className="grid gap-2">
          <FieldLabel htmlFor="company-facebook">Facebook</FieldLabel>
          <input id="company-facebook" type="url" value={form.facebookUrl} onChange={(event) => updateField("facebookUrl", event.target.value)} className={inputClassName} />
          <FieldError message={errors.facebookUrl} />
        </div>
        <div className="grid gap-2">
          <FieldLabel htmlFor="company-github">GitHub</FieldLabel>
          <input id="company-github" type="url" value={form.githubUrl} onChange={(event) => updateField("githubUrl", event.target.value)} className={inputClassName} placeholder="https://github.com/..." />
          <FieldError message={errors.githubUrl} />
        </div>
        <div className="grid gap-2">
          <FieldLabel htmlFor="company-instagram">Instagram</FieldLabel>
          <input id="company-instagram" type="url" value={form.instagramUrl} onChange={(event) => updateField("instagramUrl", event.target.value)} className={inputClassName} placeholder="https://instagram.com/..." />
          <FieldError message={errors.instagramUrl} />
        </div>
        <div className="grid gap-2">
          <FieldLabel htmlFor="company-youtube">YouTube</FieldLabel>
          <input id="company-youtube" type="url" value={form.youtubeUrl} onChange={(event) => updateField("youtubeUrl", event.target.value)} className={inputClassName} placeholder="https://youtube.com/@..." />
          <FieldError message={errors.youtubeUrl} />
        </div>
        <div className="grid gap-2 sm:col-span-2">
          <p className="text-sm font-semibold text-gray-900">Brand assets</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2 rounded-xl border border-dashed border-gray-300 bg-gray-50 p-4 text-sm font-semibold text-gray-900 dark:bg-white/5">
              <span>Logo <span className="font-normal text-gray-500">(JPG, PNG, WebP, up to 5MB)</span></span>
              <input aria-label="Upload company logo" accept="image/jpeg,image/png,image/webp" className="text-xs" onChange={(event) => handleAssetChange(event, "logo")} type="file" />
              <span className="flex h-20 w-20 overflow-hidden rounded-xl border border-gray-200 bg-white dark:bg-white/10">
                {logoPreview ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img alt="Selected company logo" className="h-full w-full object-cover" src={logoPreview} />
                ) : <AssetPreview alt="Company logo" fallback={form.name.slice(0, 1).toUpperCase() || "C"} path={form.logoPath} />}
              </span>
              {form.logoPath || logoFile ? <button type="button" onClick={() => removeAsset("logo")} className="w-fit text-xs font-semibold text-red-600 underline-offset-2 hover:underline focus:outline-none focus:ring-2 focus:ring-yellow-400">Remove logo</button> : null}
            </div>
            <div className="grid gap-2 rounded-xl border border-dashed border-gray-300 bg-gray-50 p-4 text-sm font-semibold text-gray-900 dark:bg-white/5">
              <span>Banner <span className="font-normal text-gray-500">(JPG, PNG, WebP, up to 8MB)</span></span>
              <input aria-label="Upload company banner" accept="image/jpeg,image/png,image/webp" className="text-xs" onChange={(event) => handleAssetChange(event, "banner")} type="file" />
              <span className="flex h-20 w-full overflow-hidden rounded-xl border border-gray-200 bg-white dark:bg-white/10">
                {bannerPreview ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img alt="Selected company banner" className="h-full w-full object-cover" src={bannerPreview} />
                ) : <AssetPreview alt="Company banner" fallback="B" path={form.bannerPath} />}
              </span>
              {form.bannerPath || bannerFile ? <button type="button" onClick={() => removeAsset("banner")} className="w-fit text-xs font-semibold text-red-600 underline-offset-2 hover:underline focus:outline-none focus:ring-2 focus:ring-yellow-400">Remove banner</button> : null}
            </div>
          </div>
          <FieldError message={errors.assets} />
        </div>
        <section className="grid gap-3 sm:col-span-2" aria-labelledby="company-stats-title">
          <div>
            <h2 id="company-stats-title" className="text-sm font-semibold text-gray-900">Company stats</h2>
            <p className="mt-1 text-xs text-gray-500">Live totals from your recruiter-owned jobs.</p>
          </div>
          {statsError ? <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700" role="alert">{statsError}</p> : null}
          <div className="grid gap-3 sm:grid-cols-3">
            {[{ label: "Active jobs", value: companyStats.activeJobs }, { label: "Total jobs", value: companyStats.totalJobs }, { label: "Applications", value: companyStats.totalApplications }].map((stat) => (
              <div key={stat.label} className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-4 dark:bg-white/5">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-gray-500">{stat.label}</p>
                <p className="mt-2 text-2xl font-bold text-gray-900">{isStatsLoading ? "..." : stat.value}</p>
              </div>
            ))}
          </div>
        </section>
        <section className="grid gap-4 sm:col-span-2" aria-labelledby="company-gallery-editor-title">
          <div>
            <h2 id="company-gallery-editor-title" className="text-sm font-semibold text-gray-900">Company gallery</h2>
            <p className="mt-1 text-xs text-gray-500">Share up to 24 workplace images. Files stay private and are signed for viewing.</p>
          </div>
          {galleryError ? <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700" role="alert">{galleryError}</p> : null}
          {!company ? <p className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-500 dark:bg-white/5">Save the company profile before adding gallery images.</p> : null}
          {company ? (
            <div className="grid gap-3 rounded-xl border border-dashed border-gray-300 bg-gray-50 p-4 dark:bg-white/5">
              <input accept="image/jpeg,image/png,image/webp" className="text-xs" onChange={handleGalleryFileChange} type="file" />
              <input aria-label="Gallery image description" className={inputClassName} maxLength={160} onChange={(event) => setGalleryAltText(event.target.value)} placeholder="Image description (optional)" value={galleryAltText} />
              {galleryPreview ? <div className="aspect-[4/3] max-w-xs overflow-hidden rounded-xl border border-gray-200">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img alt="Selected gallery image preview" className="h-full w-full object-cover" src={galleryPreview} />
              </div> : null}
              <button type="button" disabled={!galleryFile || isGallerySaving} onClick={() => void handleGalleryUpload()} className="inline-flex h-10 w-fit items-center justify-center rounded-xl bg-black px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50 focus:outline-none focus:ring-4 focus:ring-yellow-200">{isGallerySaving && !replacingGalleryId ? "Uploading..." : "Upload image"}</button>
            </div>
          ) : null}
          {isGalleryLoading ? <div aria-busy="true" className="h-32 animate-pulse rounded-xl bg-gray-100 dark:bg-white/10" /> : null}
          {!isGalleryLoading && gallery.length > 0 ? <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{gallery.map((item) => <div key={item.id} className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:bg-white/5"><div className="aspect-[4/3] bg-gray-100 dark:bg-white/10">{item.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
                <img alt={item.altText} className="h-full w-full object-cover" decoding="async" loading="lazy" src={item.imageUrl} />
          ) : <span className="flex h-full items-center justify-center text-xs text-gray-500">Image unavailable</span>}</div><div className="grid gap-2 p-3"><p className="break-words text-xs font-medium text-gray-700">{item.altText}</p><div className="flex flex-wrap gap-3"><label className="cursor-pointer text-xs font-semibold text-gray-900 underline-offset-2 hover:underline"><span>{replacingGalleryId === item.id ? "Replacing..." : "Replace"}</span><input accept="image/jpeg,image/png,image/webp" className="sr-only" disabled={isGallerySaving} onChange={(event) => void handleGalleryReplace(event, item)} type="file" /></label><button type="button" disabled={isGallerySaving} onClick={() => void handleGalleryDelete(item)} className="text-xs font-semibold text-red-600 underline-offset-2 hover:underline disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-yellow-400">Delete</button></div></div></div>)}</div> : null}
          {!isGalleryLoading && company && gallery.length === 0 ? <p className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-5 text-center text-sm text-gray-500 dark:bg-white/5">No gallery images yet.</p> : null}
        </section>
      </div>

      <div className="flex flex-wrap items-center justify-end gap-3 border-t border-gray-200 pt-5">
        <button type="button" onClick={() => setIsPreviewing((current) => !current)} className="inline-flex h-11 items-center justify-center rounded-xl border border-gray-200 bg-white px-4 text-sm font-semibold text-gray-900 transition hover:border-yellow-300 hover:bg-yellow-50 focus:outline-none focus:ring-4 focus:ring-yellow-200 dark:bg-white/5">
          {isPreviewing ? "Hide Preview" : "Preview Profile"}
        </button>
        {form.slug ? <Link href={`/company/${slugifyCompanyName(form.slug)}`} target="_blank" rel="noreferrer" className="inline-flex h-11 items-center justify-center rounded-xl border border-gray-200 bg-white px-4 text-sm font-semibold text-gray-900 transition hover:border-yellow-300 hover:bg-yellow-50 focus:outline-none focus:ring-4 focus:ring-yellow-200 dark:bg-white/5">Open public profile</Link> : null}
        <button type="button" disabled={isSaving} onClick={() => void handleSave()} className="inline-flex h-11 items-center justify-center rounded-xl bg-black px-5 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-60 focus:outline-none focus:ring-4 focus:ring-yellow-200">
          {isSaving ? "Saving..." : "Save Changes"}
        </button>
      </div>

      {isPreviewing ? (
        <section aria-labelledby="company-preview-title" className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm dark:bg-white/5">
          <div className="h-28 bg-gray-100 dark:bg-white/10">
            {bannerPreview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img alt="Company banner preview" className="h-full w-full object-cover" src={bannerPreview} />
            ) : <AssetPreview alt="Company banner preview" fallback="" path={form.bannerPath} />}
          </div>
          <div className="relative px-5 pb-5 pt-10">
            <span className="absolute -top-8 left-5 flex h-16 w-16 overflow-hidden rounded-2xl border-4 border-white bg-gray-50 dark:border-[#171719] dark:bg-white/10">
              {logoPreview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img alt="Company logo preview" className="h-full w-full object-cover" src={logoPreview} />
              ) : <AssetPreview alt="Company logo preview" fallback={form.name.slice(0, 1).toUpperCase() || "C"} path={form.logoPath} />}
            </span>
            <h3 id="company-preview-title" className="text-xl font-bold text-gray-900">{form.name || "Your company name"}</h3>
            <p className="mt-1 text-sm text-gray-500">{form.industry || "Industry"} {form.headquarters ? `· ${form.headquarters}` : ""}</p>
            <p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-gray-600">{form.about || "Your company description will appear here."}</p>
          </div>
        </section>
      ) : null}

      {pendingGalleryDelete ? (
        <ApplicationConfirmationDialog
          confirmLabel="Delete image"
          description="This permanently removes the selected company gallery image. The rest of your company profile will remain unchanged."
          isBusy={isGallerySaving}
          onCancel={() => setPendingGalleryDelete(null)}
          onConfirm={() => void confirmGalleryDelete()}
          title="Delete gallery image?"
        />
      ) : null}
    </div>
  );
}
