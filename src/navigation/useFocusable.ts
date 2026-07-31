import { useEffect, useId, useRef, useSyncExternalStore } from "react";
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
  const { register, unregister, requestFocus, subscribeFocus, getFocusedId } = useFocusContext();

  // `onEnter`/`disabled` are frequently inline closures that get a new
  // identity on every render. Registering once and mutating this shared node
  // object in place — instead of re-running register()/unregister() whenever
  // those identities change — keeps focus stable instead of getting reset by
  // our own re-registration on every render.
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

  // Every focus change notifies all subscribers, but useSyncExternalStore
  // only re-renders a component when *its own* snapshot actually changed —
  // so this component re-renders only on the two focus changes that involve
  // it (becoming focused, or losing focus), not on every keypress anywhere
  // in the app. This is what keeps navigation smooth as catalogs grow.
  const focused = useSyncExternalStore(subscribeFocus, () => getFocusedId() === id);

  useEffect(() => {
    if (focused) {
      ref.current?.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "smooth" });
    }
  }, [focused]);

  return { ref, focused, id };
}
