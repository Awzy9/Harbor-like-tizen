import { useEffect, useId, useRef } from "react";
import { useFocusContext } from "./FocusManager";

export interface UseFocusableOptions {
  onEnter?: () => void;
  disabled?: boolean;
  autoFocus?: boolean;
  id?: string;
}

export interface UseFocusableResult<T extends HTMLElement> {
  ref: React.RefObject<T>;
  focused: boolean;
  id: string;
}

/** Opts a single element into the TV spatial-navigation system (see FocusManager). */
export function useFocusable<T extends HTMLElement = HTMLElement>(
  options: UseFocusableOptions = {},
): UseFocusableResult<T> {
  const generatedId = useId();
  const id = options.id ?? generatedId;
  const ref = useRef<T>(null);
  const { focusedId, register, unregister, requestFocus } = useFocusContext();

  // `onEnter`/`disabled` are frequently inline closures that get a new
  // identity on every render (e.g. anything driven by focusedId itself, via
  // context). Registering once and mutating this shared node object in
  // place — instead of re-running register()/unregister() whenever those
  // identities change — keeps focus stable instead of getting reset by our
  // own re-registration on every focus change.
  const nodeRef = useRef({ ref: ref as React.RefObject<HTMLElement>, onEnter: options.onEnter, disabled: options.disabled });
  nodeRef.current.onEnter = options.onEnter;
  nodeRef.current.disabled = options.disabled;

  useEffect(() => {
    register(id, nodeRef.current);
    return () => unregister(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    if (options.autoFocus) requestFocus(id);
    // Only ever auto-focus once, on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { ref, focused: focusedId === id, id };
}
