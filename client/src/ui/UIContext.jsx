import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef
} from "react";

/**
 * The overlays that can sit on top of a screen - the drawer, a bottom sheet,
 * the anchored option picker - and the Back button that walks back out of them.
 *
 * They live together because they are mutually exclusive (opening any one
 * closes the other two) and because Back has to consider all of them in order.
 *
 * HISTORY MODEL
 *
 * Exactly one spare entry, armed at all times, and nothing else ever touches
 * history. Opening an overlay does not push; closing one does not pop.
 *
 * The previous version gave every overlay its own entry, which meant closing a
 * drawer by hand had to pop that entry, which fired a popstate that looked
 * exactly like the user pressing Back - so the handler had to guess which was
 * which, and guessed wrong often enough to make Back feel random. One entry
 * removes the ambiguity: every popstate is the user, always.
 */
const UIContext = createContext(null);

export function UIProvider({ children }) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [sheet, setSheet] = useState(null);
  const [picker, setPicker] = useState(null);

  const anyOpen = drawerOpen || sheet !== null || picker !== null;

  /**
   * What Back means. Registered by the shell, which is the only place that
   * knows both which screen is showing and whether the exit prompt is up.
   */
  const backHandlerRef = useRef(null);
  const setBackHandler = useCallback((fn) => {
    backHandlerRef.current = fn;
  }, []);

  // Set once the user has confirmed they are leaving, so the popstate that
  // leaving provokes is ignored rather than treated as another Back press.
  const exitingRef = useRef(false);

  const closeOverlays = useCallback(() => {
    setDrawerOpen(false);
    setSheet(null);
    setPicker(null);
  }, []);

  const openDrawer = useCallback(() => {
    setSheet(null);
    setPicker(null);
    setDrawerOpen(true);
  }, []);

  const openSheet = useCallback((name) => {
    setDrawerOpen(false);
    setPicker(null);
    setSheet(name);
  }, []);

  /**
   * Opens an option list anchored to `anchor`.
   *
   * `anchor` doubles as the picker's identity, which is what lets a second tap
   * on the same tile close the list rather than close-and-reopen it.
   */
  const openPicker = useCallback((config) => {
    setDrawerOpen(false);
    setSheet(null);
    setPicker(config);
  }, []);

  const togglePicker = useCallback((config) => {
    setPicker((current) => {
      if (current && current.anchor === config.anchor) return null;
      setDrawerOpen(false);
      setSheet(null);
      return config;
    });
  }, []);

  const closePicker = useCallback(() => setPicker(null), []);

  /** Puts the spare entry back on top, so the next Back press reaches us too. */
  const armBack = useCallback(() => {
    if (!window.history.state?.lehraBack) {
      window.history.pushState({ lehraBack: true }, "");
    }
  }, []);

  /**
   * Leave the app, for real.
   *
   * Three attempts, because no single one works everywhere:
   *
   *  - window.close() genuinely closes an installed PWA or a Trusted Web
   *    Activity, which is where this app is headed, and is ignored in a tab the
   *    user opened themselves.
   *  - go(-2) steps back past both entries the app owns - its own first page
   *    and the spare armed above it - landing on whatever the user was looking
   *    at before Lehra. If the page navigates, everything below is discarded
   *    with it.
   *  - If it did not navigate, Lehra was the first page in the tab and there is
   *    nowhere behind it. Rather than leave the user staring at a dialog that
   *    did nothing, the app gets out of its own way.
   *
   * exitingRef stops the popstate from go(-2) being read as another Back press
   * and re-arming the entry we are trying to leave through - which is exactly
   * what made the Leave button appear to do nothing.
   */
  const exitApp = useCallback(() => {
    exitingRef.current = true;
    window.close();
    window.history.go(-2);
    window.setTimeout(() => {
      window.location.replace("about:blank");
    }, 250);
  }, []);

  useEffect(() => {
    // Mark the entry the app loaded on, then arm a spare above it. Back lands
    // on the marked one instead of leaving, and exitApp has two to step past.
    if (!window.history.state?.lehraBase) {
      window.history.replaceState({ lehraBase: true }, "");
    }
    armBack();

    const onPopState = () => {
      if (exitingRef.current) return;
      // Re-arm first: whatever the handler decides, the press after this one
      // has to reach us as well rather than walking out of the app.
      armBack();
      backHandlerRef.current?.();
    };

    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [armBack]);

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
        setBackHandler,
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
