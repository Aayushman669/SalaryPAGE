import Script from "next/script";
import AppShell from "./app-shell";
import { AuthProvider } from "./auth-context";
import ThemeProvider from "./theme-provider";
import ToastProvider from "./toast-provider";
import { globalMetadata } from "@/lib/seo";
import { sidebarCollapsedStorageKey } from "@/lib/sidebar-state";
import "./globals.css";

export const metadata = globalMetadata;

const sidebarStateScript = `
try {
  if (window.localStorage.getItem(${JSON.stringify(sidebarCollapsedStorageKey)}) === "true") {
    document.documentElement.dataset.sidebarCollapsed = "true";
  }
} catch {}
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased" suppressHydrationWarning>
      <body className="min-h-full bg-background text-foreground">
        <Script id="sidebar-state" strategy="beforeInteractive">
          {sidebarStateScript}
        </Script>
        <ThemeProvider>
          <AuthProvider>
            <AppShell>{children}</AppShell>
            <ToastProvider />
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
