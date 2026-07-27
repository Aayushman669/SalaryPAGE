"use client";

import { toast } from "sonner";
import type { ExternalToast } from "sonner";

export type ToastId = string | number;

type ToastAction = {
  label: string;
  onClick: () => void;
};

type ToastOptions = {
  action?: ToastAction;
  dismissible?: boolean;
  duration?: number;
  id?: ToastId;
};

type PromiseToastMessages<TData> = {
  error: string | ((error: unknown) => string);
  loading: string;
  success: string | ((data: TData) => string);
};

const duplicateWindowMs = 1600;
const recentToastKeys = new Map<string, number>();

function createToastKey(type: string, message: string, description?: string) {
  return `${type}:${message}:${description ?? ""}`;
}

function shouldSkipDuplicate(key: string) {
  const now = Date.now();
  const lastShownAt = recentToastKeys.get(key);

  if (lastShownAt && now - lastShownAt < duplicateWindowMs) {
    return true;
  }

  recentToastKeys.set(key, now);

  window.setTimeout(() => {
    if (recentToastKeys.get(key) === now) {
      recentToastKeys.delete(key);
    }
  }, duplicateWindowMs);

  return false;
}

function withToastDefaults(
  type: string,
  message: string,
  description?: string,
  options?: ToastOptions,
): ExternalToast | null {
  const key = String(options?.id ?? createToastKey(type, message, description));

  if (!options?.id && shouldSkipDuplicate(key)) {
    return null;
  }

  return {
    action: options?.action
      ? {
          label: options.action.label,
          onClick: options.action.onClick,
        }
      : undefined,
    closeButton: true,
    description,
    dismissible: options?.dismissible ?? true,
    duration: options?.duration,
    id: key,
  };
}

export function showSuccessToast(
  message: string,
  description?: string,
  options?: ToastOptions,
) {
  const toastOptions = withToastDefaults("success", message, description, options);

  return toastOptions ? toast.success(message, toastOptions) : undefined;
}

export function showErrorToast(
  message: string,
  description?: string,
  options?: ToastOptions,
) {
  const toastOptions = withToastDefaults("error", message, description, options);

  return toastOptions ? toast.error(message, toastOptions) : undefined;
}

export function showWarningToast(
  message: string,
  description?: string,
  options?: ToastOptions,
) {
  const toastOptions = withToastDefaults("warning", message, description, options);

  return toastOptions ? toast.warning(message, toastOptions) : undefined;
}

export function showInfoToast(
  message: string,
  description?: string,
  options?: ToastOptions,
) {
  const toastOptions = withToastDefaults("info", message, description, options);

  return toastOptions ? toast.info(message, toastOptions) : undefined;
}

export function showLoadingToast(message: string, options?: ToastOptions) {
  const toastOptions = withToastDefaults("loading", message, undefined, {
    dismissible: false,
    ...options,
  });

  return toastOptions ? toast.loading(message, toastOptions) : undefined;
}

export function replaceLoadingToastWithSuccess(
  id: ToastId,
  message: string,
  description?: string,
  options?: Omit<ToastOptions, "id">,
) {
  return showSuccessToast(message, description, { ...options, id });
}

export function replaceLoadingToastWithError(
  id: ToastId,
  message: string,
  description?: string,
  options?: Omit<ToastOptions, "id">,
) {
  return showErrorToast(message, description, { ...options, id });
}

export function showPromiseToast<TData>(
  promise: Promise<TData>,
  messages: PromiseToastMessages<TData>,
  options?: ToastOptions,
) {
  return toast.promise(promise, {
    closeButton: true,
    error: (error) =>
      typeof messages.error === "function"
        ? messages.error(error)
        : messages.error,
    id: options?.id,
    loading: messages.loading,
    success: (data) =>
      typeof messages.success === "function"
        ? messages.success(data)
        : messages.success,
  });
}

export function dismissToast(id?: ToastId) {
  toast.dismiss(id);
}
