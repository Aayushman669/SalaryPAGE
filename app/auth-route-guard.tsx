"use client";

import { usePathname, useRouter } from "next/navigation";
import { type ReactNode, useEffect, useState } from "react";
import AuthLoading from "./auth-loading";
import { useAuth } from "./auth-context";
import {
  isAdminAuthMetadata,
  isAuthRoute as checkIsAuthRoute,
  isProtectedRoute as checkIsProtectedRoute,
} from "@/lib/auth-routes";

const DASHBOARD_ROUTE_CHECK_TIMEOUT_MS = 12_000;

async function resolveDashboardRedirect(
  getCurrentRedirectPath: () => Promise<string>,
) {
  try {
    return await Promise.race([
      getCurrentRedirectPath(),
      new Promise<string>((resolve) => {
        window.setTimeout(
          () => resolve("/dashboard"),
          DASHBOARD_ROUTE_CHECK_TIMEOUT_MS,
        );
      }),
    ]);
  } catch {
    // A valid Supabase session is already known here. Let the dashboard
    // render and let its own data loader report a profile problem if needed.
    return "/dashboard";
  }
}

function getCurrentAppPath() {
  return `${window.location.pathname}${window.location.search}${window.location.hash}`;
}

export default function AuthRouteGuard({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const {
    getCurrentRedirectPath,
    getCurrentUser,
    isAuthLoading,
    isLoggedIn,
  } = useAuth();
  const isProtectedRoute = checkIsProtectedRoute(pathname);
  const isAdminRoute = pathname === "/admin" || pathname.startsWith("/admin/");
  const isAuthRoute = checkIsAuthRoute(pathname);
  const shouldGuardRoute = isProtectedRoute || isAuthRoute;
  const routeKey = `${pathname}:${shouldGuardRoute ? "guarded" : "public"}`;
  const [isCheckingRoute, setIsCheckingRoute] = useState(shouldGuardRoute);
  const [checkedRouteKey, setCheckedRouteKey] = useState(routeKey);

  useEffect(() => {
    let isMounted = true;

    async function guardRoute() {
      if (!shouldGuardRoute) {
        setCheckedRouteKey(routeKey);
        setIsCheckingRoute(false);
        return;
      }

      setIsCheckingRoute(true);

      if (isAuthLoading) {
        return;
      }

      if (isProtectedRoute && !isLoggedIn) {
        const nextPath = encodeURIComponent(getCurrentAppPath());
        router.replace(`/login?next=${nextPath}`);
        return;
      }

      if (isProtectedRoute && isLoggedIn && isAdminRoute) {
        const user = await getCurrentUser();

        if (!user || !isAdminAuthMetadata(user.app_metadata)) {
          router.replace(await getCurrentRedirectPath());
          return;
        }
      }

      if (isProtectedRoute && isLoggedIn && !isAdminRoute) {
        const redirectPath =
          pathname === "/dashboard"
            ? await resolveDashboardRedirect(getCurrentRedirectPath)
            : await getCurrentRedirectPath();

        if (pathname === "/account-restricted") {
          if (redirectPath !== "/account-restricted") {
            router.replace(redirectPath);
            return;
          }
        } else if (pathname === "/onboarding") {
          if (redirectPath === "/dashboard") {
            router.replace("/dashboard");
            return;
          }
        } else if (redirectPath === "/onboarding") {
          router.replace("/onboarding");
          return;
        } else if (redirectPath === "/login") {
          const nextPath = encodeURIComponent(getCurrentAppPath());
          router.replace(`/login?next=${nextPath}`);
          return;
        }
      }

      if (isAuthRoute && isLoggedIn) {
        router.replace(await getCurrentRedirectPath());
        return;
      }

      if (isMounted) {
        setCheckedRouteKey(routeKey);
        setIsCheckingRoute(false);
      }
    }

    guardRoute();

    return () => {
      isMounted = false;
    };
  }, [
    getCurrentRedirectPath,
    getCurrentUser,
    isAuthLoading,
    isAuthRoute,
    isAdminRoute,
    isLoggedIn,
    isProtectedRoute,
    pathname,
    router,
    routeKey,
    shouldGuardRoute,
  ]);

  const isRouteTransitionPending = checkedRouteKey !== routeKey;

  if (shouldGuardRoute && (isAuthLoading || isCheckingRoute || isRouteTransitionPending)) {
    return <AuthLoading />;
  }

  return children;
}
