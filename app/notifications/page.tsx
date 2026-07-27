import type { Metadata } from "next";
import NotificationPage from "./notification-page";

export const metadata: Metadata = {
  title: "Notifications",
  description: "Review your account notifications.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function NotificationsRoute() {
  return <NotificationPage />;
}
