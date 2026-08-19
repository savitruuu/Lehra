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
   * Leave the app.
   *
   * Installed, this closes the window and hands the user back to their home
   * screen, which is what Back at the bottom of an app should do. That only
   * works in standalone display mode - window.close() is ignored for a tab the
   * user opened themselves, and a home-screen *shortcut* is exactly that: a
   * browser tab wearing an icon. See the manifest link in index.html.
   *
   * In an ordinary tab it steps back past both entries the app owns - its own
   * first page and the spare armed above it - landing on whatever the user was
   * looking at before Lehra. If there is nothing behind it, nothing happens and
   * the app simply carries on, which is the only honest outcome available.
   *
   * It emphatically does not navigate to about:blank. That did leave the app,
   * technically, and what the user saw was a blank browser page where their
   * practice tool used to be.
   *
   * exitingRef stops the popstate from go(-2) being read as another Back press
   * and re-arming the entry we are trying to leave through - which is what made
   * leaving appear to do nothing at all.
   */
  const exitApp = useCallback(() => {
    exitingRef.current = true;
    window.close();
    window.history.go(-2);

    window.setTimeout(() => {
      // Still here: an ordinary tab with no page behind it. Re-arm, so Back
      // keeps working rather than walking out on the next press.
      exitingRef.current = false;
      armBack();
    }, 400);
  }, [armBack]);

  /**
   * True when the app is running in its own window rather than a browser tab -
   * installed from the browser's "Install app", or launched from a home screen
   * entry that a manifest turned into a real app rather than a shortcut.
   */
  const isStandalone = useCallback(
    () =>
      window.matchMedia?.("(display-mode: standalone)").matches ||
      window.navigator.standalone === true,
    []
  );

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
        exitApp,
        isStandalone
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
