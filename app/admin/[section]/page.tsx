import { notFound } from "next/navigation";
import AdminPanel from "../admin-panel";
import { adminSections, type AdminSection } from "@/lib/admin-types";

export default async function AdminSectionPage({ params }: { params: Promise<{ section: string }> }) {
  const { section } = await params;
  if (!adminSections.includes(section as AdminSection) || section === "overview") {
    notFound();
  }

  return <AdminPanel section={section as AdminSection} />;
}
