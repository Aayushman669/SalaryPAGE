import AppShell from "./app-shell";
import { AuthProvider } from "./auth-context";
import ThemeProvider from "./theme-provider";
import ToastProvider from "./toast-provider";
import { globalMetadata } from "@/lib/seo";
import "./globals.css";

export const metadata = globalMetadata;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased" suppressHydrationWarning>
      <body className="min-h-full bg-background text-foreground">
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
