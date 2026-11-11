import React, { useEffect } from "react";
import { createPortal } from "react-dom";

interface PortalMenuProps {
  isOpen: boolean;
  onClose: () => void;
  triggerRef: React.RefObject<HTMLElement | null>;
  children: React.ReactNode;
  width?: number;
  className?: string;
  align?: "left" | "right";
}

export const PortalMenu: React.FC<PortalMenuProps> = ({
  isOpen,
  onClose,
  triggerRef,
  children,
  width,
  className = "",
  align = "left",
}) => {
  useEffect(() => {
    if (!isOpen) return;

    const handleMouseDown = (e: MouseEvent) => {
      if (triggerRef.current && triggerRef.current.contains(e.target as Node)) {
        return;
      }
      onClose();
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };

    document.addEventListener("mousedown", handleMouseDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleMouseDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose, triggerRef]);

  if (!isOpen || typeof document === "undefined") return null;

  const rect = triggerRef.current?.getBoundingClientRect();
  const top = rect ? rect.bottom + 4 : 100;
  let left = rect ? rect.left : 100;

  if (align === "right" && rect && width) {
    left = rect.right - width;
  }

  // Ajustar para que no se salga de los márgenes de la ventana
  if (width) {
    if (left + width > window.innerWidth - 12) {
      left = window.innerWidth - width - 12;
    }
  }
  if (left < 12) left = 12;

  return createPortal(
    <div
      style={{
        position: "fixed",
        top: `${top}px`,
        left: `${left}px`,
        zIndex: 999999,
        ...(width ? { width: `${width}px` } : {}),
      }}
      className={`bg-white text-[#201f1e] border border-[#d2d0ce] rounded-xl shadow-2xl p-1.5 animate-in fade-in select-none max-h-[80vh] overflow-y-auto ${className}`}
    >
      {children}
    </div>,
    document.body
  );
};
