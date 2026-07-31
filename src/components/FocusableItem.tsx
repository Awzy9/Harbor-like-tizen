import type { ReactNode } from "react";
import { useFocusable } from "@/navigation/useFocusable";
import "./FocusableItem.css";

interface FocusableItemProps {
  onEnter?: () => void;
  disabled?: boolean;
  selected?: boolean;
  loading?: boolean;
  autoFocus?: boolean;
  id?: string;
  className?: string;
  children: ReactNode;
}

/**
 * Base focusable tile/button for the TV UI. Every interactive element in the
 * app should render through this (or something built on useFocusable) so
 * "which element has focus" is never ambiguous on a remote-only interface.
 */
export function FocusableItem({
  onEnter,
  disabled,
  selected,
  loading,
  autoFocus,
  id,
  className,
  children,
}: FocusableItemProps) {
  const { ref, focused } = useFocusable<HTMLDivElement>({ onEnter, disabled, autoFocus, id });

  const classes = [
    "focusable-item",
    focused && "is-focused",
    selected && "is-selected",
    disabled && "is-disabled",
    loading && "is-loading",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div ref={ref} className={classes} aria-disabled={disabled} data-focused={focused}>
      {children}
    </div>
  );
}
