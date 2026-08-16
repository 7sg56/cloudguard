"use client";

import { useEffect } from "react";
import { X } from "lucide-react";

interface ToastProps {
  message: string;
  onClose?: () => void;
  onDismiss?: () => void;
  duration?: number;
}

export function Toast({ message, onClose, onDismiss, duration = 4000 }: ToastProps) {
  const handleClose = onClose || onDismiss || (() => {});

  useEffect(() => {
    const timer = setTimeout(handleClose, duration);
    return () => clearTimeout(timer);
  }, [handleClose, duration]);

  return (
    <div className="fixed top-4 right-4 z-[100] animate-slide-down">
      <div className="flex items-center gap-3 px-4 py-3 bg-emerald-600 text-white rounded-lg shadow-lg">
        <span className="text-sm font-medium">{message}</span>
        <button
          onClick={handleClose}
          className="p-0.5 hover:bg-emerald-700 rounded transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
