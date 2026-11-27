import { useEffect, useState } from "react";
import { Platform } from "react-native";
import { keyboardInset } from "./keyboard";

function currentInset(): number {
  const viewport = typeof window === "undefined" ? undefined : window.visualViewport;
  if (!viewport) return 0;
  return keyboardInset({
    layoutHeight: document.documentElement.clientHeight,
    height: viewport.height,
    offsetTop: viewport.offsetTop,
    scale: viewport.scale,
  });
}

/**
 * On the web, the height the keyboard covers at the bottom of the page, so bottom-anchored
 * views can sit above it. Always 0 on iOS and Android, where KeyboardAvoidingView or the
 * system resizing the window does this job.
 */
export function useKeyboardInset(): number {
  const [inset, setInset] = useState(() => (Platform.OS === "web" ? currentInset() : 0));
  useEffect(() => {
    if (Platform.OS !== "web" || typeof window === "undefined") return;
    const viewport = window.visualViewport;
    if (!viewport) return;
    const update = () => {
      const next = currentInset();
      setInset(next);
      // Safari can leave the page scrolled after the keyboard closes; the app never scrolls the page.
      if (next === 0 && window.scrollY !== 0) window.scrollTo(0, 0);
    };
    update();
    viewport.addEventListener("resize", update);
    viewport.addEventListener("scroll", update);
    return () => {
      viewport.removeEventListener("resize", update);
      viewport.removeEventListener("scroll", update);
    };
  }, []);
  return inset;
}
