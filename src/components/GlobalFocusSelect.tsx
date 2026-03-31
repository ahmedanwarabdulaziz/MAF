"use client";

import { useEffect } from "react";

export default function GlobalFocusSelect() {
  useEffect(() => {
    const handleFocusIn = (e: FocusEvent) => {
      const target = e.target as HTMLElement;

      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement
      ) {
        if (
          target instanceof HTMLInputElement &&
          (target.type === "checkbox" ||
            target.type === "radio" ||
            target.type === "file" ||
            target.type === "button" ||
            target.type === "submit" ||
            target.type === "reset")
        ) {
          return;
        }

        // Use a small timeout to let the browser finish its default focus behavior
        setTimeout(() => {
          try {
            target.select();
          } catch (err) {
            // Ignore errors for input types that might not support select()
          }
        }, 10);
      }
    };

    window.addEventListener("focusin", handleFocusIn);
    return () => window.removeEventListener("focusin", handleFocusIn);
  }, []);

  return null;
}
