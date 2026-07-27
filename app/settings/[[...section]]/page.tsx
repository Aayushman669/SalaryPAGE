import SettingsPageClient from "../settings-page-client";

export default async function SettingsPage({
  params,
}: {
  params: Promise<{ section?: string[] }>;
}) {
  const { section } = await params;

  return <SettingsPageClient initialSectionId={section?.[0]} />;
}
