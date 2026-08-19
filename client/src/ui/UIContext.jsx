import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef
} from "react";

/**
 * The three things that can sit on top of the player: the drawer, a bottom
 * sheet, and the anchored option picker.
 *
 * They live together because they are mutually exclusive - opening any one
 * closes the other two - and because they share one history entry between them.
 * Three separate pieces of state would mean three places to remember that rule
 * and three chances to get the back button wrong.
 */
const UIContext = createContext(null);

export function UIProvider({ children }) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [sheet, setSheet] = useState(null);
  const [picker, setPicker] = useState(null);

  const anyOpen = drawerOpen || sheet !== null || picker !== null;
  const anyOpenRef = useRef(anyOpen);
  anyOpenRef.current = anyOpen;

  const closeOverlays = useCallback(({ fromHistory = false } = {}) => {
    setDrawerOpen(false);
    setSheet(null);
    setPicker(null);

    // Pop the dummy entry we pushed when opening, unless we are already inside
    // a popstate - otherwise closing by hand would leave a stale entry behind
    // and the next Back press would do nothing visible.
    if (!fromHistory && anyOpenRef.current && window.history.state?.overlay) {
      window.history.back();
    }
  }, []);

  /**
   * Pushes a dummy history entry so the hardware Back button closes the overlay
   * instead of leaving the app.
   */
  const pushOverlayHistory = useCallback(() => {
    if (!window.history.state?.overlay) {
      window.history.pushState({ overlay: true }, "");
    }
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
   * on the same tile close the list rather than close-and-reopen it - until
   * that distinction existed, tapping a tile twice read as the list refusing to
   * go away.
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
    const onPopState = () => {
      if (anyOpenRef.current) closeOverlays({ fromHistory: true });
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [closeOverlays]);

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
        closeOverlays
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
