import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { ReactNode, RefObject } from "react";
import { subscribeToRemote } from "@/tizen/remote";
import { findNextFocus, type Rect } from "./spatialNav";

interface RegisteredNode {
  ref: RefObject<HTMLElement>;
  onEnter?: () => void;
  disabled?: boolean;
}

interface FocusContextValue {
  focusedId: string | undefined;
  register: (id: string, node: RegisteredNode) => void;
  unregister: (id: string) => void;
  requestFocus: (id: string) => void;
  pushBackHandler: (handler: () => void) => () => void;
}

const FocusContext = createContext<FocusContextValue | undefined>(undefined);

function rectOf(el: HTMLElement): Rect {
  const r = el.getBoundingClientRect();
  return { top: r.top, left: r.left, right: r.right, bottom: r.bottom, width: r.width, height: r.height };
}

/**
 * Root TV navigation provider: owns "which element currently has focus" and
 * routes remote-control up/down/left/right/enter/back into DOM-rect-based
 * spatial navigation, since a TV has no pointer to rely on. Mount once near
 * the app root.
 */
export function FocusProvider({ children }: { children: ReactNode }) {
  const nodes = useRef(new Map<string, RegisteredNode>());
  const backStack = useRef<Array<() => void>>([]);
  const [focusedId, setFocusedId] = useState<string | undefined>(undefined);

  const register = useCallback((id: string, node: RegisteredNode) => {
    nodes.current.set(id, node);
  }, []);

  const unregister = useCallback((id: string) => {
    nodes.current.delete(id);
    setFocusedId((current) => (current === id ? undefined : current));
  }, []);

  const requestFocus = useCallback((id: string) => {
    if (nodes.current.has(id)) setFocusedId(id);
  }, []);

  const pushBackHandler = useCallback((handler: () => void) => {
    backStack.current.push(handler);
    return () => {
      backStack.current = backStack.current.filter((h) => h !== handler);
    };
  }, []);

  // Read via a ref rather than depending on `focusedId` directly, so this
  // subscribes to the remote exactly once instead of tearing down and
  // re-adding a window keydown listener on every focus change.
  const focusedIdRef = useRef(focusedId);
  focusedIdRef.current = focusedId;

  useEffect(() => {
    return subscribeToRemote((action) => {
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
        // Nothing focused yet — focus the first registered, enabled node.
        for (const [id, node] of nodes.current) {
          if (!node.disabled && node.ref.current) {
            setFocusedId(id);
            return;
          }
        }
        return;
      }

      const candidates = Array.from(nodes.current.entries())
        .filter(([id, node]) => id !== focusedId && !node.disabled && node.ref.current)
        .map(([id, node]) => ({ id, rect: rectOf(node.ref.current as HTMLElement) }));

      const nextId = findNextFocus(rectOf(currentEl), action, candidates);
      if (nextId) setFocusedId(nextId);
    });
  }, []);

  const value = useMemo<FocusContextValue>(
    () => ({ focusedId, register, unregister, requestFocus, pushBackHandler }),
    [focusedId, register, unregister, requestFocus, pushBackHandler],
  );

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
