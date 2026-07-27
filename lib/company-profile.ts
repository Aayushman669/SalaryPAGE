import {
  CONNECTION_ERROR_MESSAGE,
  isNetworkError,
  isValidEmail,
  logAuthError,
} from "@/lib/auth-errors";
import { safeHttpUrl } from "@/lib/input-safety";
import { supabase } from "@/lib/supabase";
import { validateUploadFileSignature } from "@/lib/upload-validation";

export const companySizeOptions = [
  "1-10",
  "11-50",
  "51-200",
  "201-500",
  "501-1000",
  "1001+",
] as const;

export const companyWorkModelOptions = ["remote", "hybrid", "on_site"] as const;
export const companyHiringStatusOptions = [
  "hiring",
  "not_hiring",
  "always_hiring",
] as const;

export type CompanySize = (typeof companySizeOptions)[number];
export type CompanyWorkModel = (typeof companyWorkModelOptions)[number];
export type CompanyHiringStatus = (typeof companyHiringStatusOptions)[number];
export type CompanyVerificationStatus =
  | "unverified"
  | "pending"
  | "verified"
  | "rejected";

export type CompanyProfile = {
  address: string | null;
  about: string | null;
  benefits: string[];
  company_size: CompanySize | null;
  contact_email: string | null;
  contact_phone: string | null;
  created_at: string;
  facebook_url: string | null;
  founded_year: number | null;
  github_url: string | null;
  headquarters: string | null;
  hiring_status: CompanyHiringStatus;
  id: string;
  industry: string | null;
  instagram_url: string | null;
  linkedin_url: string | null;
  logo_path: string | null;
  banner_path: string | null;
  mission: string | null;
  name: string;
  profile_completion: number;
  recruiter_id: string;
  slug: string;
  updated_at: string;
  verification_status: CompanyVerificationStatus;
  website: string | null;
  work_model: CompanyWorkModel | null;
  x_url: string | null;
  culture: string | null;
  vision: string | null;
  youtube_url: string | null;
};

export type CompanyProfileForm = {
  address: string;
  about: string;
  benefits: string;
  companySize: CompanySize | "";
  contactEmail: string;
  contactPhone: string;
  facebookUrl: string;
  foundedYear: string;
  githubUrl: string;
  headquarters: string;
  hiringStatus: CompanyHiringStatus;
  industry: string;
  instagramUrl: string;
  linkedinUrl: string;
  logoPath: string | null;
  bannerPath: string | null;
  mission: string;
  name: string;
  slug: string;
  culture: string;
  website: string;
  vision: string;
  workModel: CompanyWorkModel | "";
  xUrl: string;
  youtubeUrl: string;
};

export type CompanyValidationErrors = Partial<
  Record<keyof CompanyProfileForm | "assets", string>
>;

export type CompanyValidationResult = {
  errors: CompanyValidationErrors;
  valid: boolean;
};

const companySelectColumns =
  "id, recruiter_id, name, slug, logo_path, banner_path, about, mission, vision, culture, website, industry, company_size, founded_year, headquarters, address, contact_email, contact_phone, linkedin_url, github_url, x_url, facebook_url, instagram_url, youtube_url, work_model, hiring_status, benefits, verification_status, profile_completion, created_at, updated_at";

function cleanText(value: string | null | undefined) {
  return value?.trim() ?? "";
}

export function slugifyCompanyName(value: string) {
  return cleanText(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 160);
}

function isValidHttpUrl(value: string) {
  return safeHttpUrl(value) !== null;
}

function isValidPhone(value: string) {
  const digits = value.replace(/\D/g, "");
  return digits.length >= 7 && digits.length <= 15 && /^[+()\-\s\d]+$/.test(value);
}

export function createCompanyForm(company?: CompanyProfile | null): CompanyProfileForm {
  return {
    address: company?.address ?? "",
    about: company?.about ?? "",
    bannerPath: company?.banner_path ?? null,
    benefits: company?.benefits.join("\n") ?? "",
    companySize: company?.company_size ?? "",
    contactEmail: company?.contact_email ?? "",
    contactPhone: company?.contact_phone ?? "",
    facebookUrl: company?.facebook_url ?? "",
    foundedYear: company?.founded_year ? String(company.founded_year) : "",
    githubUrl: company?.github_url ?? "",
    headquarters: company?.headquarters ?? "",
    hiringStatus: company?.hiring_status ?? "hiring",
    industry: company?.industry ?? "",
    instagramUrl: company?.instagram_url ?? "",
    linkedinUrl: company?.linkedin_url ?? "",
    logoPath: company?.logo_path ?? null,
    mission: company?.mission ?? "",
    name: company?.name ?? "",
    slug: company?.slug ?? "",
    culture: company?.culture ?? "",
    workModel: company?.work_model ?? "",
    website: company?.website ?? "",
    vision: company?.vision ?? "",
    xUrl: company?.x_url ?? "",
    youtubeUrl: company?.youtube_url ?? "",
  };
}

function validateOptionalUrl(value: string, label: string, errors: CompanyValidationErrors, field: keyof CompanyProfileForm) {
  if (value && !isValidHttpUrl(value)) {
    errors[field] = `${label} must be a valid http or https URL.`;
  }
}

export function validateCompanyProfile(form: CompanyProfileForm): CompanyValidationResult {
  const errors: CompanyValidationErrors = {};
  const name = cleanText(form.name);
  const slug = slugifyCompanyName(form.slug || form.name);
  const about = cleanText(form.about);
  const industry = cleanText(form.industry);
  const contactEmail = cleanText(form.contactEmail);
  const foundedYear = form.foundedYear ? Number(form.foundedYear) : null;

  if (name.length < 2 || name.length > 140) {
    errors.name = "Company name must be between 2 and 140 characters.";
  }

  if (slug.length < 3 || slug.length > 160 || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    errors.slug = "Use lowercase letters, numbers, and hyphens for the company slug.";
  }

  if (about.length < 40 || about.length > 8000) {
    errors.about = "Tell candidates about your company in 40 to 8,000 characters.";
  }

  if (industry.length < 2 || industry.length > 120) {
    errors.industry = "Add an industry between 2 and 120 characters.";
  }

  if (!form.companySize) {
    errors.companySize = "Choose a company size.";
  }

  if (!form.workModel) {
    errors.workModel = "Choose the company's primary work model.";
  }

  if (!contactEmail || !isValidEmail(contactEmail)) {
    errors.contactEmail = "Enter a valid company contact email.";
  }

  if (form.contactPhone && !isValidPhone(form.contactPhone)) {
    errors.contactPhone = "Enter a valid contact phone number.";
  }

  if (form.foundedYear && (!Number.isInteger(foundedYear) || foundedYear! < 1800 || foundedYear! > new Date().getFullYear() + 1)) {
    errors.foundedYear = "Enter a valid founded year.";
  }

  validateOptionalUrl(form.website, "Website", errors, "website");
  validateOptionalUrl(form.linkedinUrl, "LinkedIn", errors, "linkedinUrl");
  validateOptionalUrl(form.githubUrl, "GitHub", errors, "githubUrl");
  validateOptionalUrl(form.xUrl, "X", errors, "xUrl");
  validateOptionalUrl(form.facebookUrl, "Facebook", errors, "facebookUrl");
  validateOptionalUrl(form.instagramUrl, "Instagram", errors, "instagramUrl");
  validateOptionalUrl(form.youtubeUrl, "YouTube", errors, "youtubeUrl");

  if (!companyHiringStatusOptions.includes(form.hiringStatus)) {
    errors.hiringStatus = "Choose a valid hiring status.";
  }

  if (form.address.length > 240) {
    errors.address = "Address must be 240 characters or fewer.";
  }

  for (const [field, label] of [
    ["mission", "Mission"],
    ["vision", "Vision"],
    ["culture", "Culture"],
  ] as const) {
    if (form[field].length > 4000) {
      errors[field] = `${label} must be 4,000 characters or fewer.`;
    }
  }

  return { errors, valid: Object.keys(errors).length === 0 };
}

export function calculateCompanyProfileCompletion(form: CompanyProfileForm) {
  const checks = [
    Boolean(cleanText(form.name)),
    Boolean(slugifyCompanyName(form.slug || form.name)),
    Boolean(cleanText(form.about)),
    Boolean(cleanText(form.industry)),
    Boolean(form.companySize),
    Boolean(form.workModel),
    Boolean(cleanText(form.headquarters)),
    Boolean(cleanText(form.contactEmail)),
    Boolean(cleanText(form.website)),
    Boolean(cleanText(form.logoPath)),
    Boolean(cleanText(form.bannerPath)),
    Boolean(cleanText(form.benefits)),
  ];

  return Math.round((checks.filter(Boolean).length / checks.length) * 100);
}

function getFriendlyCompanyError(error: unknown) {
  if (isNetworkError(error)) {
    return CONNECTION_ERROR_MESSAGE;
  }

  const text = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();

  if (text.includes("duplicate") || text.includes("unique")) {
    return "That company slug is already in use. Choose another one.";
  }

  if (text.includes("row-level security") || text.includes("permission")) {
    return "You do not have permission to update this company profile.";
  }

  if (text.includes("relation") || text.includes("column") || text.includes("does not exist")) {
    return "Company profiles are not ready yet. Please run the latest company migration in Supabase.";
  }

  return "We could not save your company profile. Please try again.";
}

export async function getCompanyProfile(recruiterId: string) {
  if (!supabase) {
    return {
      company: null,
      error: "Supabase is not configured. Please check your environment variables.",
    };
  }

  try {
    const { data, error } = await supabase
      .from("companies")
      .select(companySelectColumns)
      .eq("recruiter_id", recruiterId)
      .maybeSingle();

    if (error) {
      logAuthError("[company] fetch failed", error);
      return { company: null, error: getFriendlyCompanyError(error) };
    }

    return { company: (data as CompanyProfile | null) ?? null, error: null };
  } catch (error) {
    logAuthError("[company] fetch network failure", error);
    return { company: null, error: getFriendlyCompanyError(error) };
  }
}

export async function saveCompanyProfile({
  companyId,
  form,
  recruiterId,
}: {
  companyId: string | null;
  form: CompanyProfileForm;
  recruiterId: string;
}) {
  if (!supabase) {
    return {
      company: null,
      error: "Supabase is not configured. Please check your environment variables.",
    };
  }

  try {
    const normalizedSlug = slugifyCompanyName(form.slug || form.name);
    const { data: conflictingCompany, error: slugLookupError } = await supabase
      .from("companies")
      .select("id")
      .eq("slug", normalizedSlug)
      .neq("recruiter_id", recruiterId)
      .maybeSingle();

    if (slugLookupError) {
      logAuthError("[company] slug lookup failed", slugLookupError);
      return { company: null, error: getFriendlyCompanyError(slugLookupError) };
    }

    if (conflictingCompany) {
      return { company: null, error: "That company slug is already in use. Choose another one." };
    }

    const completion = calculateCompanyProfileCompletion({
      ...form,
      slug: normalizedSlug,
    });
    const payload = {
      about: cleanText(form.about),
      address: cleanText(form.address) || null,
      banner_path: form.bannerPath,
      benefits: cleanText(form.benefits)
        .split("\n")
        .map((benefit) => benefit.trim())
        .filter(Boolean)
        .slice(0, 30),
      company_size: form.companySize || null,
      contact_email: cleanText(form.contactEmail),
      contact_phone: cleanText(form.contactPhone) || null,
      facebook_url: cleanText(form.facebookUrl) || null,
      founded_year: form.foundedYear ? Number(form.foundedYear) : null,
      github_url: cleanText(form.githubUrl) || null,
      headquarters: cleanText(form.headquarters) || null,
      hiring_status: form.hiringStatus,
      industry: cleanText(form.industry),
      instagram_url: cleanText(form.instagramUrl) || null,
      linkedin_url: cleanText(form.linkedinUrl) || null,
      logo_path: form.logoPath,
      mission: cleanText(form.mission) || null,
      name: cleanText(form.name),
      profile_completion: completion,
      slug: normalizedSlug,
      ...(companyId ? {} : { verification_status: "unverified" }),
      website: cleanText(form.website) || null,
      vision: cleanText(form.vision) || null,
      work_model: form.workModel || null,
      x_url: cleanText(form.xUrl) || null,
      culture: cleanText(form.culture) || null,
      youtube_url: cleanText(form.youtubeUrl) || null,
    };

    const companyQuery = companyId
      ? supabase
          .from("companies")
          .update(payload)
          .eq("id", companyId)
          .eq("recruiter_id", recruiterId)
      : supabase.from("companies").insert({ ...payload, recruiter_id: recruiterId });
    const { data, error } = await companyQuery
      .select(companySelectColumns)
      .single();

    if (error) {
      logAuthError("[company] save failed", error);
      return { company: null, error: getFriendlyCompanyError(error) };
    }

    return { company: data as CompanyProfile, error: null };
  } catch (error) {
    logAuthError("[company] save network failure", error);
    return { company: null, error: getFriendlyCompanyError(error) };
  }
}

export type CompanyStats = {
  activeJobs: number;
  totalApplications: number;
  totalJobs: number;
};

export async function getCompanyStats(recruiterId: string): Promise<{
  stats: CompanyStats;
  error: string | null;
}> {
  const emptyStats = { activeJobs: 0, totalApplications: 0, totalJobs: 0 };

  if (!supabase) {
    return {
      stats: emptyStats,
      error: "Company statistics are temporarily unavailable.",
    };
  }

  try {
    const { data: jobs, error: jobsError } = await supabase
      .from("jobs")
      .select("id, status, moderation_status, publish_at, expires_at")
      .eq("created_by", recruiterId);

    if (jobsError) {
      logAuthError("[company] stats jobs query failed", jobsError);
      return { stats: emptyStats, error: "Company statistics are temporarily unavailable." };
    }

    const rows = (jobs ?? []) as Array<{
      expires_at: string | null;
      id: string;
      moderation_status: string | null;
      publish_at: string | null;
      status: string | null;
    }>;
    const now = Date.now();
    const activeJobs = rows.filter((job) => {
      const publishAt = job.publish_at ? Date.parse(job.publish_at) : null;
      const expiresAt = job.expires_at ? Date.parse(job.expires_at) : null;
      return (
        job.status === "published" &&
        (job.moderation_status === null || job.moderation_status === "active") &&
        (publishAt === null || Number.isNaN(publishAt) || publishAt <= now) &&
        (expiresAt === null || Number.isNaN(expiresAt) || expiresAt > now)
      );
    }).length;
    const jobIds = rows.map((job) => job.id);

    if (jobIds.length === 0) {
      return { stats: { activeJobs, totalApplications: 0, totalJobs: rows.length }, error: null };
    }

    const { count, error: applicationsError } = await supabase
      .from("applications")
      .select("id", { count: "exact", head: true })
      .in("job_id", jobIds);

    if (applicationsError) {
      logAuthError("[company] stats applications query failed", applicationsError);
      return { stats: emptyStats, error: "Company statistics are temporarily unavailable." };
    }

    return {
      stats: { activeJobs, totalApplications: count ?? 0, totalJobs: rows.length },
      error: null,
    };
  } catch (error) {
    logAuthError("[company] stats request failed", error);
    return { stats: emptyStats, error: "Company statistics are temporarily unavailable." };
  }
}

export const companyAssetMaxBytes = {
  banner: 8 * 1024 * 1024,
  gallery: 8 * 1024 * 1024,
  logo: 5 * 1024 * 1024,
} as const;

const companyImageTypes: ReadonlyMap<string, string> = new Map([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
] as const);

export type CompanyGalleryItem = {
  altText: string;
  companyId: string;
  createdAt: string;
  id: string;
  imageUrl: string | null;
  storagePath: string;
};

type CompanyGalleryRow = {
  alt_text: string;
  company_id: string;
  created_at: string;
  id: string;
  storage_path: string;
};

export function validateCompanyImageFile(file: File, kind: "banner" | "gallery" | "logo") {
  const extension = companyImageTypes.get(file.type);
  if (!extension || file.size <= 0 || file.size > companyAssetMaxBytes[kind]) {
    return {
      error: `${kind === "logo" ? "Logo" : kind === "banner" ? "Banner" : "Gallery image"} must be a JPG, PNG, or WebP image within the size limit.`,
      extension: null,
    };
  }

  return { error: null, extension };
}

export async function deleteCompanyAsset(path: string | null) {
  if (!supabase || !path) {
    return { error: null };
  }

  try {
    const { error } = await supabase.storage.from("company-assets").remove([path]);
    if (error) {
      logAuthError("[company] asset delete failed", error);
      return { error: "The previous image could not be removed. You can retry safely." };
    }
    return { error: null };
  } catch (error) {
    logAuthError("[company] asset delete request failed", error);
    return { error: "The previous image could not be removed. You can retry safely." };
  }
}

export async function getCompanyGallery(companyId: string) {
  if (!supabase) {
    return { gallery: [] as CompanyGalleryItem[], error: "Gallery is temporarily unavailable." };
  }

  try {
    const { data, error } = await supabase
      .from("company_gallery")
      .select("id, company_id, storage_path, alt_text, created_at")
      .eq("company_id", companyId)
      .order("created_at", { ascending: true })
      .limit(24);

    if (error) {
      logAuthError("[company] gallery fetch failed", error);
      return { gallery: [] as CompanyGalleryItem[], error: getFriendlyCompanyError(error) };
    }

    const rows = (data ?? []) as CompanyGalleryRow[];
    const gallery = await Promise.all(rows.map(async (row) => ({
      altText: row.alt_text,
      companyId: row.company_id,
      createdAt: row.created_at,
      id: row.id,
      imageUrl: await getCompanyAssetUrl(row.storage_path),
      storagePath: row.storage_path,
    })));
    return { gallery, error: null };
  } catch (error) {
    logAuthError("[company] gallery fetch request failed", error);
    return { gallery: [] as CompanyGalleryItem[], error: "Gallery is temporarily unavailable." };
  }
}

export async function uploadCompanyGalleryImage({
  altText,
  companyId,
  file,
  recruiterId,
}: {
  altText: string;
  companyId: string;
  file: File;
  recruiterId: string;
}) {
  if (!supabase) {
    return { item: null, error: "Gallery is temporarily unavailable." };
  }

  const validation = validateCompanyImageFile(file, "gallery");
  const normalizedAlt = cleanText(altText).slice(0, 160) || "Company gallery image";
  if (validation.error || !validation.extension) {
    return { item: null, error: validation.error };
  }

  const signatureError = await validateUploadFileSignature(file, file.type as
    "image/jpeg" | "image/png" | "image/webp");

  if (signatureError) {
    return { item: null, error: signatureError };
  }

  const storagePath = `${recruiterId}/gallery/${crypto.randomUUID()}.${validation.extension}`;
  try {
    const { error: uploadError } = await supabase.storage
      .from("company-assets")
      .upload(storagePath, file, { cacheControl: "3600", contentType: file.type, upsert: false });
    if (uploadError) {
      logAuthError("[company] gallery upload failed", uploadError);
      return { item: null, error: getFriendlyCompanyError(uploadError) };
    }

    const { data, error: insertError } = await supabase
      .from("company_gallery")
      .insert({ alt_text: normalizedAlt, company_id: companyId, storage_path: storagePath })
      .select("id, company_id, storage_path, alt_text, created_at")
      .single();
    if (insertError || !data) {
      await deleteCompanyAsset(storagePath);
      logAuthError("[company] gallery record insert failed", insertError);
      return { item: null, error: getFriendlyCompanyError(insertError) };
    }

    const row = data as CompanyGalleryRow;
    return {
      item: {
        altText: row.alt_text,
        companyId: row.company_id,
        createdAt: row.created_at,
        id: row.id,
        imageUrl: await getCompanyAssetUrl(row.storage_path),
        storagePath: row.storage_path,
      } satisfies CompanyGalleryItem,
      error: null,
    };
  } catch (error) {
    await deleteCompanyAsset(storagePath);
    logAuthError("[company] gallery upload request failed", error);
    return { item: null, error: "Gallery image upload failed. Please try again." };
  }
}

export async function replaceCompanyGalleryImage({
  altText,
  file,
  item,
  recruiterId,
}: {
  altText: string;
  file: File;
  item: CompanyGalleryItem;
  recruiterId: string;
}) {
  if (!supabase) {
    return { item: null, error: "Gallery is temporarily unavailable." };
  }
  const validation = validateCompanyImageFile(file, "gallery");
  if (validation.error || !validation.extension) {
    return { item: null, error: validation.error };
  }

  const signatureError = await validateUploadFileSignature(file, file.type as
    "image/jpeg" | "image/png" | "image/webp");

  if (signatureError) {
    return { item: null, error: signatureError };
  }

  const storagePath = `${recruiterId}/gallery/${crypto.randomUUID()}.${validation.extension}`;
  try {
    const { error: uploadError } = await supabase.storage
      .from("company-assets")
      .upload(storagePath, file, { cacheControl: "3600", contentType: file.type, upsert: false });
    if (uploadError) {
      return { item: null, error: getFriendlyCompanyError(uploadError) };
    }

    const { data, error: updateError } = await supabase
      .from("company_gallery")
      .update({ alt_text: cleanText(altText).slice(0, 160) || "Company gallery image", storage_path: storagePath })
      .eq("id", item.id)
      .eq("company_id", item.companyId)
      .select("id, company_id, storage_path, alt_text, created_at")
      .single();
    if (updateError || !data) {
      await deleteCompanyAsset(storagePath);
      return { item: null, error: getFriendlyCompanyError(updateError) };
    }

    await deleteCompanyAsset(item.storagePath);
    const row = data as CompanyGalleryRow;
    return {
      item: {
        altText: row.alt_text,
        companyId: row.company_id,
        createdAt: row.created_at,
        id: row.id,
        imageUrl: await getCompanyAssetUrl(row.storage_path),
        storagePath: row.storage_path,
      } satisfies CompanyGalleryItem,
      error: null,
    };
  } catch (error) {
    await deleteCompanyAsset(storagePath);
    logAuthError("[company] gallery replacement failed", error);
    return { item: null, error: "Gallery image replacement failed. Please try again." };
  }
}

export async function deleteCompanyGalleryImage(item: CompanyGalleryItem) {
  if (!supabase) {
    return { error: "Gallery is temporarily unavailable." };
  }
  try {
    const { error: recordError } = await supabase
      .from("company_gallery")
      .delete()
      .eq("id", item.id)
      .eq("company_id", item.companyId);
    if (recordError) {
      return { error: getFriendlyCompanyError(recordError) };
    }
    const result = await deleteCompanyAsset(item.storagePath);
    return { error: result.error };
  } catch (error) {
    logAuthError("[company] gallery delete failed", error);
    return { error: "Gallery image could not be removed. Please try again." };
  }
}

export async function uploadCompanyAsset({
  file,
  kind,
  recruiterId,
}: {
  file: File;
  kind: "logo" | "banner";
  recruiterId: string;
}) {
  if (!supabase) {
    return {
      error: "Supabase is not configured. Please check your environment variables.",
      path: null,
    };
  }

  const validation = validateCompanyImageFile(file, kind);

  if (validation.error || !validation.extension) {
    return {
      error: validation.error,
      path: null,
    };
  }

  const signatureError = await validateUploadFileSignature(file, file.type as
    "image/jpeg" | "image/png" | "image/webp");

  if (signatureError) {
    return { error: signatureError, path: null };
  }

  const extension = validation.extension;
  const path = `${recruiterId}/${kind}.${extension}`;

  try {
    const { error } = await supabase.storage
      .from("company-assets")
      .upload(path, file, { cacheControl: "3600", contentType: file.type, upsert: true });

    if (error) {
      logAuthError(`[company] ${kind} upload failed`, error);
      return { error: getFriendlyCompanyError(error), path: null };
    }

    return { error: null, path };
  } catch (error) {
    logAuthError(`[company] ${kind} upload network failure`, error);
    return { error: getFriendlyCompanyError(error), path: null };
  }
}

export async function getCompanyAssetUrl(path: string | null) {
  if (!supabase || !path) {
    return null;
  }

  const { data, error } = await supabase.storage
    .from("company-assets")
    .createSignedUrl(path, 3600);

  if (error || !data?.signedUrl) {
    if (error) {
      logAuthError("[company] signed asset URL failed", error);
    }
    return null;
  }

  return data.signedUrl;
}
