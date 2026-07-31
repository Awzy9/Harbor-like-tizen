import { createContext, useCallback, useContext, useEffect, useRef } from "react";
import type { ReactNode, RefObject } from "react";
import { subscribeToRemote } from "@/tizen/remote";
import { findNextFocus, type Rect } from "./spatialNav";

interface RegisteredNode {
  ref: RefObject<HTMLElement>;
  onEnter?: () => void;
  disabled?: boolean;
}

interface FocusContextValue {
  register: (id: string, node: RegisteredNode) => void;
  unregister: (id: string) => void;
  requestFocus: (id: string) => void;
  pushBackHandler: (handler: () => void) => () => void;
  /** External-store subscription for "focus changed somewhere" — see useFocusable's useSyncExternalStore usage for why this is coarse-grained. */
  subscribeFocus: (listener: () => void) => () => void;
  getFocusedId: () => string | undefined;
}

const FocusContext = createContext<FocusContextValue | undefined>(undefined);

function rectOf(el: HTMLElement): Rect {
  const r = el.getBoundingClientRect();
  return { top: r.top, left: r.left, right: r.right, bottom: r.bottom, width: r.width, height: r.height };
}

/** First enabled, mounted node still in the registry — used to recover focus when it's lost rather than leaving it undefined. */
function pickFallbackId(nodes: Map<string, RegisteredNode>): string | undefined {
  for (const [id, node] of nodes) {
    if (!node.disabled && node.ref.current) return id;
  }
  return undefined;
}

/**
 * Root TV navigation provider: owns "which element currently has focus" and
 * routes remote-control up/down/left/right/enter/back into DOM-rect-based
 * spatial navigation, since a TV has no pointer to rely on. Mount once near
 * the app root.
 *
 * Focus state lives in a ref + a plain subscriber list (a manual external
 * store), NOT React state — with React state in context, every focus change
 * re-rendered every single FocusableItem on screen (the context Provider's
 * value object changes identity whenever focusedId changes, so every
 * consumer re-renders to check "is it me?"). On a TV's much weaker CPU, that
 * turned rapid remote input into visible stutter. useFocusable subscribes
 * via useSyncExternalStore instead, which only re-renders a component when
 * *its own* computed snapshot (its `focused` boolean) actually changes —
 * i.e. only the previously-focused and newly-focused elements re-render per
 * keypress, not everything.
 */
export function FocusProvider({ children }: { children: ReactNode }) {
  const nodes = useRef(new Map<string, RegisteredNode>());
  const backStack = useRef<Array<() => void>>([]);
  const focusedIdRef = useRef<string | undefined>(undefined);
  const listeners = useRef(new Set<() => void>());

  const notify = useCallback(() => {
    for (const listener of listeners.current) listener();
  }, []);

  const setFocusedId = useCallback(
    (id: string | undefined) => {
      if (focusedIdRef.current === id) return;
      focusedIdRef.current = id;
      notify();
    },
    [notify],
  );

  const register = useCallback((id: string, node: RegisteredNode) => {
    nodes.current.set(id, node);
  }, []);

  const unregister = useCallback(
    (id: string) => {
      nodes.current.delete(id);
      if (focusedIdRef.current === id) {
        // The focused element just unmounted (e.g. navigating to another
        // screen) — recover immediately instead of leaving focus lost until
        // the next keypress just to rediscover where it landed.
        setFocusedId(pickFallbackId(nodes.current));
      }
    },
    [setFocusedId],
  );

  const requestFocus = useCallback(
    (id: string) => {
      if (nodes.current.has(id)) setFocusedId(id);
    },
    [setFocusedId],
  );

  const pushBackHandler = useCallback((handler: () => void) => {
    backStack.current.push(handler);
    return () => {
      backStack.current = backStack.current.filter((h) => h !== handler);
    };
  }, []);

  const subscribeFocus = useCallback((listener: () => void) => {
    listeners.current.add(listener);
    return () => {
      listeners.current.delete(listener);
    };
  }, []);

  const getFocusedId = useCallback(() => focusedIdRef.current, []);

  useEffect(() => {
    return subscribeToRemote((action) => {
      // A real <input>/<textarea> (e.g. the add-on URL field) needs native
      // text editing — arrow keys move the cursor, Enter submits — so once
      // one has real DOM focus, spatial nav must get out of the way
      // entirely instead of preventDefault-ing those keys out from under it.
      // Back is the one exception: it exits the field back to spatial nav.
      const active = document.activeElement;
      if (active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement) {
        if (action === "back") active.blur();
        return;
      }

      const focusedId = focusedIdRef.current;

      if (action === "enter") {
        if (!focusedId) return;
        nodes.current.get(focusedId)?.onEnter?.();
        return;
      }

      if (action === "back") {
        const top = backStack.current[backStack.current.length - 1];
        top?.();
        return;
      }

      if (action !== "up" && action !== "down" && action !== "left" && action !== "right") {
        return; // media-transport keys are handled by the player screen, not global nav
      }

      const currentNode = focusedId ? nodes.current.get(focusedId) : undefined;
      const currentEl = currentNode?.ref.current;
      if (!currentEl) {
        setFocusedId(pickFallbackId(nodes.current));
        return;
      }

      const candidates = Array.from(nodes.current.entries())
        .filter(([id, node]) => id !== focusedId && !node.disabled && node.ref.current)
        .map(([id, node]) => ({ id, rect: rectOf(node.ref.current as HTMLElement) }));

      const nextId = findNextFocus(rectOf(currentEl), action, candidates);
      if (nextId) setFocusedId(nextId);
    });
  }, [setFocusedId]);

  // Stable for the provider's lifetime — nothing about this value ever
  // changes identity, so FocusProvider's own re-renders (which basically
  // never happen, since it holds no reactive state itself) never cascade
  // into consumers either.
  const value = useRef<FocusContextValue>({
    register,
    unregister,
    requestFocus,
    pushBackHandler,
    subscribeFocus,
    getFocusedId,
  }).current;

  return <FocusContext.Provider value={value}>{children}</FocusContext.Provider>;
}

export function useFocusContext(): FocusContextValue {
  const ctx = useContext(FocusContext);
  if (!ctx) throw new Error("useFocusContext must be used within a FocusProvider");
  return ctx;
}

/** Registers a screen-level Back handler for as long as the screen is mounted. */
export function useBackHandler(handler: () => void): void {
  const { pushBackHandler } = useFocusContext();
  useEffect(() => pushBackHandler(handler), [pushBackHandler, handler]);
}
