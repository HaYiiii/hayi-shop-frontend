"use client";

import { Toast as ToastPrimitive } from "radix-ui";
import { type ReactNode, createContext, use, useCallback, useState } from "react";
import { focusRing } from "./variants.js";

export type ToastOptions = {
  /** One line: what just happened ("Đã thêm vào giỏ"). */
  title: string;
  /** At most one line of detail. */
  description?: string;
  /** At most one action ("Xem giỏ", "Hoàn tác"); `altText` tells screen-reader users how to reach it. */
  action?: { label: string; altText: string; onClick: () => void };
};

type ToastItem = ToastOptions & { id: number };

const ToastContext = createContext<((options: ToastOptions) => void) | null>(null);

/** Show a short confirmation after an action. Not for errors to fix or important notices. */
export function useToast() {
  const show = use(ToastContext);
  if (!show) throw new Error("useToast must be used inside <ToastProvider>");
  return show;
}

let nextId = 0;

/** Wrap the app once. Toasts auto-hide after 5 s, bottom (mobile) / bottom-right (desktop). */
export function ToastProvider({ children, label = "Thông báo" }: { children: ReactNode; label?: string }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const show = useCallback((options: ToastOptions) => {
    nextId += 1;
    setToasts((current) => [...current, { ...options, id: nextId }]);
  }, []);

  const remove = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  return (
    <ToastContext value={show}>
      <ToastPrimitive.Provider duration={5000} label={label} swipeDirection="down">
        {children}
        {toasts.map((toast) => (
          <ToastPrimitive.Root
            key={toast.id}
            // "background" makes Radix announce politely (D2: aria-live="polite").
            type="background"
            onOpenChange={(open) => {
              if (!open) remove(toast.id);
            }}
            className={`grid w-full grid-cols-[auto_1fr_auto] items-start gap-3 rounded-lg bg-ink px-4 py-3 text-body text-paper shadow-overlay ${focusRing}`}
          >
            <svg
              aria-hidden="true"
              viewBox="0 0 20 20"
              className="mt-px size-5"
              fill="none"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="10" cy="10" r="9" strokeWidth="1.5" />
              <path d="M6 10.5l2.5 2.5L14 7.5" strokeWidth="1.8" />
            </svg>
            <div className="min-w-0 break-words">
              <ToastPrimitive.Title className="font-semibold">{toast.title}</ToastPrimitive.Title>
              {toast.description ? (
                <ToastPrimitive.Description className="text-sunken">{toast.description}</ToastPrimitive.Description>
              ) : null}
            </div>
            {toast.action ? (
              <ToastPrimitive.Action
                altText={toast.action.altText}
                onClick={toast.action.onClick}
                className={`cursor-pointer font-semibold text-matcha-100 underline underline-offset-3 hover:text-paper ${focusRing} focus-visible:outline-paper`}
              >
                {toast.action.label}
              </ToastPrimitive.Action>
            ) : null}
          </ToastPrimitive.Root>
        ))}
        <ToastPrimitive.Viewport label={`${label} ({hotkey})`} className="fixed inset-x-4 bottom-[max(16px,env(safe-area-inset-bottom))] z-[60] flex flex-col gap-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus md:left-auto md:right-6 md:bottom-6 md:w-[360px]" />
      </ToastPrimitive.Provider>
    </ToastContext>
  );
}
