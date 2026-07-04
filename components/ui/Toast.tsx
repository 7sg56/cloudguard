"use client";

import { useEffect } from "react";
import { X } from "lucide-react";

interface ToastProps {
  message: string;
  onDismiss: () => void;
  duration?: number;
}

export function Toast({ message, onDismiss, duration = 5000 }: ToastProps) {
  useEffect(() => {
    const timer = setTimeout(onDismiss, duration);
    return () => clearTimeout(timer);
  }, [onDismiss, duration]);

  return (
    <div className="fixed top-4 right-4 z-[100] animate-slide-down">
      <div className="flex items-center gap-3 px-4 py-3 bg-emerald-600 text-white rounded-lg shadow-lg">
        <span className="text-sm font-medium">{message}</span>
        <button
          onClick={onDismiss}
          className="p-0.5 hover:bg-emerald-700 rounded transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
