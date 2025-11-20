// src/components/ui/Modal.tsx
"use client";

import { X } from "lucide-react";

export function Modal({
  open,
  onClose,
  title,
  children,
  width = "max-w-lg",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  width?: string;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/30">
      <div className={`bg-white rounded-2xl shadow-xl w-full ${width} mx-4`}>
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="text-lg font-semibold text-[#0E1F36]">{title}</h2>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-700">
            <X size={20} />
          </button>
        </div>
        <div className="px-6 py-4 space-y-4">{children}</div>
      </div>
    </div>
  );
}
