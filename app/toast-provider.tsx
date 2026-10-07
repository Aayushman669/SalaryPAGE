"use client";

import { useEffect, useState } from "react";
import { Toaster } from "sonner";

type ToastPosition = "top-center" | "top-right";

function ToastIcon({ label, mark }: { label: string; mark: string }) {
  return (
    <span
      aria-label={label}
      className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-yellow-300 bg-yellow-50 text-xs font-black text-gray-900"
    >
      {mark}
    </span>
  );
}

export default function ToastProvider() {
  const [position, setPosition] = useState<ToastPosition>("top-right");

  useEffect(() => {
    const mediaQuery = window.matchMedia("(max-width: 640px)");

    function updatePosition() {
      setPosition(mediaQuery.matches ? "top-center" : "top-right");
    }

    updatePosition();
    mediaQuery.addEventListener("change", updatePosition);

    return () => {
      mediaQuery.removeEventListener("change", updatePosition);
    };
  }, []);

  return (
    <Toaster
      closeButton
      containerAriaLabel="Notifications"
      duration={4200}
      expand={false}
      gap={10}
      mobileOffset={16}
      offset={24}
      position={position}
      theme="light"
      visibleToasts={4}
      icons={{
        error: <ToastIcon label="Error" mark="!" />,
        info: <ToastIcon label="Info" mark="i" />,
        loading: <ToastIcon label="Loading" mark="..." />,
        success: <ToastIcon label="Success" mark="OK" />,
        warning: <ToastIcon label="Warning" mark="!" />,
      }}
      toastOptions={{
        classNames: {
          actionButton:
            "rounded-lg border border-gray-900 bg-black px-3 py-1.5 text-xs font-semibold text-white outline-none transition-all duration-200 hover:shadow-[0_0_0_3px_rgba(234,179,8,0.18)] focus:ring-4 focus:ring-yellow-200",
          closeButton:
            "border border-gray-200 bg-white text-gray-500 transition-colors duration-200 hover:text-gray-900 focus:ring-4 focus:ring-yellow-200",
          content: "min-w-0",
          description: "mt-1 break-words text-sm leading-5 text-gray-500",
          error: "border-l-4 border-l-gray-900",
          info: "border-l-4 border-l-yellow-300",
          loading: "border-l-4 border-l-yellow-300",
          success: "border-l-4 border-l-yellow-500",
          title: "break-words text-sm font-bold text-gray-900",
          toast:
            "rounded-xl border border-gray-200 bg-[#FEFEFC] p-4 text-gray-900 shadow-[0_20px_60px_rgba(0,0,0,0.10)]",
          warning: "border-l-4 border-l-yellow-400",
        },
      }}
    />
  );
}
