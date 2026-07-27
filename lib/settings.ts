import type {
  DashboardPlan,
  DashboardProfile,
  DashboardRole,
} from "@/lib/dashboard-data";
import { formatPlan } from "@/lib/dashboard-data";
import type { ThemePreference } from "@/lib/theme";
import type { EmailPreferenceState } from "@/lib/email/types";

export type SettingsSectionId =
  | "account"
  | "appearance"
  | "billing"
  | "danger"
  | "job-alerts"
  | "notifications"
  | "preferences"
  | "privacy"
  | "profile"
  | "security";

export type SettingsAvailability = "available" | "coming-soon" | "future";

export type SettingsIconName =
  | "account"
  | "appearance"
  | "billing"
  | "danger"
  | "job-alerts"
  | "notifications"
  | "preferences"
  | "privacy"
  | "profile"
  | "security";

export type SettingsSection = {
  availability: SettingsAvailability;
  description: string;
  icon: SettingsIconName;
  id: SettingsSectionId;
  title: string;
};

export type ProfileSettings = {
  avatarUrl: string | null;
  email: string | null;
  fullName: string | null;
  profileCompleted: boolean;
  roleMode: DashboardRole | null;
};

export type AccountSettings = {
  email: string | null;
  userId: string;
};

export type SecuritySettings = {
  connectedAccounts: string[];
  sessionsReady: boolean;
  twoFactorEnabled: boolean;
};

export type NotificationSettings = {
  emailPreferences: EmailPreferenceState;
  emailNotificationsReady: boolean;
  inAppNotificationsReady: boolean;
};

export type AppearanceSettings = {
  themePreference: ThemePreference | null;
};

export type BillingSettings = {
  currentPlan: DashboardPlan;
  planLabel: string;
};

export type PreferenceSettings = {
  currency: string | null;
  language: string | null;
  timezone: string | null;
};

export type DangerZoneSettings = {
  accountDeletionReady: boolean;
  dataExportReady: boolean;
};

export type SettingsData = {
  account: AccountSettings;
  appearance: AppearanceSettings;
  billing: BillingSettings;
  danger: DangerZoneSettings;
  notifications: NotificationSettings;
  preferences: PreferenceSettings;
  profile: ProfileSettings;
  security: SecuritySettings;
  sections: readonly SettingsSection[];
};

export const defaultSettingsSectionId: SettingsSectionId = "profile";

export const settingsSections = [
  {
    availability: "available",
    description: "Manage your personal profile and recruiter identity.",
    icon: "profile",
    id: "profile",
    title: "Profile",
  },
  {
    availability: "available",
    description: "View your sign-in email and account verification state.",
    icon: "account",
    id: "account",
    title: "Account Access",
  },
  {
    availability: "available",
    description: "Password and safe account security information.",
    icon: "security",
    id: "security",
    title: "Security",
  },
  {
    availability: "available",
    description: "Control product, hiring, and account notifications.",
    icon: "notifications",
    id: "notifications",
    title: "Notifications",
  },
  {
    availability: "available",
    description: "Control profile and resume visibility for authorized recruiters.",
    icon: "privacy",
    id: "privacy",
    title: "Privacy",
  },
  {
    availability: "available",
    description: "Control global and individual job alert preferences.",
    icon: "preferences",
    id: "job-alerts",
    title: "Job Alerts",
  },
  {
    availability: "available",
    description: "Choose your theme preference and future visual settings.",
    icon: "appearance",
    id: "appearance",
    title: "Appearance",
  },
  {
    availability: "available",
    description: "View your plan, usage, payments, and purchase history.",
    icon: "billing",
    id: "billing",
    title: "Billing",
  },
  {
    availability: "available",
    description: "Choose the recruiter email categories you want to receive.",
    icon: "preferences",
    id: "preferences",
    title: "Email Preferences",
  },
  {
    availability: "available",
    description: "Privacy controls and account deletion requests.",
    icon: "danger",
    id: "danger",
    title: "Danger Zone",
  },
] as const satisfies readonly SettingsSection[];

const settingsSectionIds = new Set<SettingsSectionId>(
  settingsSections.map((section) => section.id),
);

export function isSettingsSectionId(
  value: string | null | undefined,
): value is SettingsSectionId {
  return settingsSectionIds.has(value as SettingsSectionId);
}

export function normalizeSettingsSectionId(
  value: string | null | undefined,
): SettingsSectionId {
  return isSettingsSectionId(value) ? value : defaultSettingsSectionId;
}

export function getSettingsSectionsForRole(role: DashboardRole | null) {
  const recruiterSectionIds: SettingsSectionId[] = [
    "profile",
    "account",
    "security",
    "notifications",
    "preferences",
    "appearance",
    "billing",
    "danger",
  ];

  const candidateSectionIds: SettingsSectionId[] = [
    "profile",
    "security",
    "notifications",
    "privacy",
    "job-alerts",
    "appearance",
    "danger",
  ];

  const allowedIds = role === "recruiter" ? recruiterSectionIds : candidateSectionIds;

  return settingsSections.filter((section) => allowedIds.includes(section.id));
}

export function normalizeSettingsSectionForRole(
  value: string | null | undefined,
  role: DashboardRole | null,
): SettingsSectionId {
  const sectionId = normalizeSettingsSectionId(value);

  return getSettingsSectionsForRole(role).some(
    (section) => section.id === sectionId,
  )
    ? sectionId
    : defaultSettingsSectionId;
}

export function getSettingsSection(sectionId: SettingsSectionId) {
  return (
    settingsSections.find((section) => section.id === sectionId) ??
    settingsSections[0]
  );
}

export function getSettingsSectionHref(sectionId: SettingsSectionId) {
  return `/settings/${sectionId}`;
}

export function buildSettingsData(profile: DashboardProfile): SettingsData {
  return {
    account: {
      email: profile.email,
      userId: profile.id,
    },
    appearance: {
      themePreference: null,
    },
    billing: {
      currentPlan: profile.current_plan,
      planLabel: formatPlan(profile.current_plan),
    },
    danger: {
      accountDeletionReady: false,
      dataExportReady: false,
    },
    notifications: {
      emailNotificationsReady: true,
      emailPreferences: {
        adminMessagesEmail: true,
        jobNotifications: true,
        productUpdates: true,
        securityEmails: true,
      },
      inAppNotificationsReady: false,
    },
    preferences: {
      currency: null,
      language: null,
      timezone: null,
    },
    profile: {
      avatarUrl: profile.avatar_url,
      email: profile.email,
      fullName: profile.full_name,
      profileCompleted: profile.profile_completed === true,
      roleMode: profile.role_mode,
    },
    security: {
      connectedAccounts: [],
      sessionsReady: false,
      twoFactorEnabled: false,
    },
    sections: getSettingsSectionsForRole(profile.role_mode),
  };
}
