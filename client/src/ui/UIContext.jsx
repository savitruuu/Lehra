import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef
} from "react";

/**
 * The three things that can sit on top of the player - the drawer, a bottom
 * sheet, the anchored option picker - and the Back button that dismisses them.
 *
 * They live together because they are mutually exclusive (opening any one
 * closes the other two) and because they share the browser's history with each
 * other and with the Back handling below. Three separate pieces of state would
 * mean three places to remember that rule and three chances to get Back wrong.
 */
const UIContext = createContext(null);

/**
 * Two Back presses inside this window mean "I really do want out", and the app
 * stops intercepting. Long enough that a deliberate double-press registers,
 * short enough that a press now and another a minute later are two separate
 * intentions rather than an accidental exit.
 */
const DOUBLE_BACK_MS = 2000;

export function UIProvider({ children }) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [sheet, setSheet] = useState(null);
  const [picker, setPicker] = useState(null);

  const anyOpen = drawerOpen || sheet !== null || picker !== null;
  const anyOpenRef = useRef(anyOpen);
  anyOpenRef.current = anyOpen;

  /**
   * What Back should do when it lands with nothing open.
   *
   * Registered by the shell, because the answer depends on which screen is
   * showing and this context deliberately knows nothing about screens.
   */
  const backFallbackRef = useRef(null);
  const setBackFallback = useCallback((fn) => {
    backFallbackRef.current = fn;
  }, []);

  // Set while we call history.back() ourselves, so the popstate it triggers can
  // be told apart from the user pressing Back. Without it, closing the drawer by
  // hand pops an entry, the handler sees nothing open, and the fallback below
  // fires as though the user had asked to go back.
  const programmaticBackRef = useRef(false);
  const lastBackAtRef = useRef(0);

  const closeOverlays = useCallback(({ fromHistory = false } = {}) => {
    setDrawerOpen(false);
    setSheet(null);
    setPicker(null);

    if (!fromHistory && anyOpenRef.current && window.history.state?.overlay) {
      programmaticBackRef.current = true;
      window.history.back();
    }
  }, []);

  /**
   * Puts a spare entry on top of the history stack.
   *
   * This is what makes Back reach the app at all. Without an entry to consume,
   * the first Back press walks straight out of the page and no handler runs -
   * so the app keeps one in reserve at all times and replaces it after every
   * press it handles.
   */
  const armBack = useCallback(() => {
    if (!window.history.state?.lehraBack) {
      window.history.pushState({ lehraBack: true }, "");
    }
  }, []);

  /** Kept for the overlays, which mark their entry so closeOverlays can pop it. */
  const pushOverlayHistory = useCallback(() => {
    if (!window.history.state?.overlay) {
      window.history.pushState({ overlay: true, lehraBack: true }, "");
    }
  }, []);

  /**
   * Leave the app.
   *
   * A web page cannot force its own tab shut: window.close() is honoured only
   * for a window opened by script or an installed PWA. So the honest thing is
   * to stop holding the user in - drop the spare entry and let the navigation
   * they asked for continue. In a plain tab that lands on whatever they were
   * looking at before Lehra, and if Lehra was the first page in the tab the
   * browser simply stays put, which is the correct non-destructive outcome.
   */
  const exitApp = useCallback(() => {
    window.close();
    window.history.go(-1);
  }, []);

  const openDrawer = useCallback(() => {
    setSheet(null);
    setPicker(null);
    setDrawerOpen(true);
    pushOverlayHistory();
  }, [pushOverlayHistory]);

  const openSheet = useCallback(
    (name) => {
      setDrawerOpen(false);
      setPicker(null);
      setSheet(name);
      pushOverlayHistory();
    },
    [pushOverlayHistory]
  );

  /**
   * Opens an option list anchored to `anchor`.
   *
   * `anchor` doubles as the picker's identity, which is what lets a second tap
   * on the same tile close the list rather than close-and-reopen it.
   */
  const openPicker = useCallback(
    (config) => {
      setDrawerOpen(false);
      setSheet(null);
      setPicker(config);
      pushOverlayHistory();
    },
    [pushOverlayHistory]
  );

  const togglePicker = useCallback(
    (config) => {
      setPicker((current) => {
        if (current && current.anchor === config.anchor) return null;
        setDrawerOpen(false);
        setSheet(null);
        pushOverlayHistory();
        return config;
      });
    },
    [pushOverlayHistory]
  );

  const closePicker = useCallback(() => setPicker(null), []);

  useEffect(() => {
    // Mark the entry the app loaded on, then arm a spare above it. Back then
    // lands on the marked entry rather than leaving, and exitApp's go(-1) has
    // somewhere to go when the user really means it.
    if (!window.history.state?.lehraBase) {
      window.history.replaceState({ lehraBase: true }, "");
    }
    armBack();

    const onPopState = () => {
      // Our own history.back(), not the user's.
      if (programmaticBackRef.current) {
        programmaticBackRef.current = false;
        armBack();
        return;
      }

      const now = Date.now();
      const isSecondPress = now - lastBackAtRef.current < DOUBLE_BACK_MS;
      lastBackAtRef.current = now;

      // Twice in quick succession means out, whatever is on screen.
      if (isSecondPress) {
        exitApp();
        return;
      }

      // Re-arm before doing anything else, so the press after this one is also
      // ours to handle rather than walking out of the app.
      armBack();

      if (anyOpenRef.current) {
        closeOverlays({ fromHistory: true });
        return;
      }

      backFallbackRef.current?.();
    };

    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [armBack, closeOverlays, exitApp]);

  return (
    <UIContext.Provider
      value={{
        drawerOpen,
        openDrawer,
        sheet,
        openSheet,
        picker,
        openPicker,
        togglePicker,
        closePicker,
        anyOpen,
        closeOverlays,
        setBackFallback,
        exitApp
      }}
    >
      {children}
    </UIContext.Provider>
  );
}

export function useUI() {
  const ctx = useContext(UIContext);
  if (!ctx) throw new Error("useUI must be used inside <UIProvider>");
  return ctx;
}
