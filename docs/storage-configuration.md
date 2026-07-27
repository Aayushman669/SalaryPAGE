# Supabase Storage Configuration

The hosted Supabase migration role cannot update `storage.buckets`. The bucket
limits below must be configured or verified in the Supabase Dashboard under
Storage, or through a supported Supabase management API used by the deployment
owner. Do not run SQL updates against `storage.buckets`.

## Required bucket settings

| Bucket | Public | Maximum file size | Allowed MIME types |
| --- | --- | ---: | --- |
| `candidate-profile-assets` | Off | 8 MB (8,388,608 bytes) | `image/jpeg`, `image/png`, `image/webp`, `application/pdf` |
| `application-resumes` | Off | 5 MB (5,242,880 bytes) | `application/pdf` |
| `company-assets` | Off | 8 MB (8,388,608 bytes) | `image/jpeg`, `image/png`, `image/webp` |

These values match the existing bucket definitions and upload validation in
the application. Candidate profile photos, recruiter avatars, and application
resumes have stricter per-flow limits where applicable.

## Access requirements

- Keep all three buckets private. Do not enable public listing or public URLs.
- Use short-lived signed URLs for private assets. The application currently
  uses signed URLs for recruiter avatars, company assets, and recruiter resume
  access.
- Keep the existing `storage.objects` RLS policies. They constrain object paths
  to the authenticated owner and preserve role, profile, job, application, and
  candidate-privacy checks.
- `candidate-profile-assets`: candidates may manage their own profile paths;
  recruiters may upload their own avatar path; authorized recruiter reads are
  mediated by the existing candidate privacy policies.
- `application-resumes`: candidates may upload their own PDF paths and delete
  only unsubmitted resumes; recruiters may read only resumes attached to their
  own job applications.
- `company-assets`: recruiters may upload, read, update, and delete only
  objects whose first path segment is their own user ID and whose metadata is
  associated with their company.
- Do not grant `anon` access to private objects or bypass signed URL checks.

## Deployment checklist

1. Confirm each bucket exists with the exact name in the table.
2. Set Public to Off for each bucket.
3. Set the maximum file size and allowed MIME types exactly as shown.
4. Confirm the existing object policies are present after migrations run.
5. Upload one valid and one invalid file for each flow using a test account.
6. Confirm invalid size/type uploads are rejected and that signed URLs expire.

The migration `20260724100000_harden_storage_bucket_limits.sql` is a documented
no-op. It no longer mutates Supabase-managed storage tables.
