import { useState, useEffect, useCallback } from "react";

import { UIProvider, useUI } from "./ui/UIContext.jsx";
import { PlayerProvider, usePlayer } from "./player/PlayerContext.jsx";
import { AuthProvider } from "./auth/AuthContext.jsx";

import { Drawer, MobileHeader, MobileNav } from "./components/Navigation.jsx";
import { TilePicker } from "./components/TilePicker.jsx";
import { Screensaver } from "./components/Screensaver.jsx";
import { ExitPrompt } from "./components/ExitPrompt.jsx";
import { useSliderDrag } from "./components/useSliderDrag.js";
import { useKeyboardControls } from "./components/useKeyboardControls.js";
import { useDrawerSwipe } from "./components/useDrawerSwipe.js";

import { PlayerScreen } from "./screens/PlayerScreen.jsx";
import { AnalyticsScreen } from "./screens/AnalyticsScreen.jsx";
import { TaalScreen } from "./screens/TaalScreen.jsx";
import { SettingsScreen } from "./screens/SettingsScreen.jsx";

export default function App() {
  return (
    <AuthProvider>
      <UIProvider>
        <PlayerProvider>
          <Shell />
        </PlayerProvider>
      </UIProvider>
    </AuthProvider>
  );
}

function Shell() {
  // `navId` rather than the screen name, because Lehra and Tabla are two doors
  // into the same screen and only the id tells them apart.
  const [navId, setNavId] = useState("player");
  const [screen, setScreen] = useState("player");
  const [exitPromptOpen, setExitPromptOpen] = useState(false);

  const {
    anyOpen, closeOverlays, openDrawer, exitApp,
    drawerOpen, sheet, picker, closePicker, setBackHandler
  } = useUI();
  const { setTablaMode, screensaverOn, noteActivity } = usePlayer();

  useSliderDrag();
  useKeyboardControls();
  // Swipe right from anywhere to reach the drawer, left to put it back.
  useDrawerSwipe({
    onOpen: openDrawer,
    onClose: closeOverlays,
    drawerOpen,
    enabled: !exitPromptOpen
  });

  // The player is the one screen pinned to a single viewport; the rest still
  // scroll, so the stylesheet needs to know which is showing.
  useEffect(() => {
    document.body.classList.toggle("player-active", screen === "player");
  }, [screen]);

  /**
   * Leaving, with a way back if it turns out we cannot.
   *
   * Installed, exitApp closes the window and nothing below ever runs. In a
   * browser tab with no page behind it there is nothing it can do, and the
   * callback takes the prompt down rather than leaving it up having visibly
   * failed.
   */
  const leaveApp = useCallback(() => {
    exitApp(() => setExitPromptOpen(false));
  }, [exitApp]);

  /**
   * What Back does, as one ordered list.
   *
   * Every press takes exactly one step outward, and the last step is leaving:
   *
   *   picker or sheet open  ->  close it
   *   drawer open           ->  ask about leaving
   *   glossary / analytics
   *     / settings          ->  open the drawer, the way you came in
   *   player                ->  ask about leaving
   *   prompt already up     ->  leave
   *
   * Which makes Back from the player two presses to exit, and from any other
   * screen a walk back through the drawer to the same question. The order lives
   * here, in one function, rather than being split between this file and the
   * history handling - that split is what made it behave differently depending
   * on how you had arrived.
   */
  const handleBack = useCallback(() => {
    if (exitPromptOpen) {
      leaveApp();
      return;
    }
    if (picker) {
      closePicker();
      return;
    }
    if (sheet) {
      closeOverlays();
      return;
    }
    if (drawerOpen || screen === "player") {
      setExitPromptOpen(true);
      return;
    }
    openDrawer();
  }, [
    exitPromptOpen, picker, sheet, drawerOpen, screen,
    leaveApp, closePicker, closeOverlays, openDrawer
  ]);

  useEffect(() => {
    setBackHandler(handleBack);
  }, [handleBack, setBackHandler]);

  const navigate = (item) => {
    setExitPromptOpen(false);
    setNavId(item.id);
    setScreen(item.target);
    // Any nav item other than the two player doors leaves accompaniment mode
    // exactly as it was - there is no third state to reconcile it with.
    if (item.tablaMode !== undefined) setTablaMode(item.tablaMode);
  };

  /**
   * Any touch postpones the screensaver; a touch while it is showing dismisses
   * it. Capture phase, so it is seen before anything swallows it.
   */
  useEffect(() => {
    const onPointerDown = (e) => {
      // The Reset button lives inside the screensaver and is meant to be
      // pressed there, so let its click through and leave the graphic up.
      // Swallowing it the way every other touch is swallowed would mean the
      // button could never be reached - the first tap would only dismiss.
      if (screensaverOn && e.target.closest?.("#screensaver-reset")) return;

      noteActivity();
      if (screensaverOn) {
        e.stopPropagation();
        e.preventDefault();
      }
    };

    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("keydown", noteActivity, true);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("keydown", noteActivity, true);
    };
  }, [screensaverOn, noteActivity]);

  return (
    <>
      <div className="app-container">
        <Drawer navId={navId} onNavigate={navigate} />
        <MobileHeader />

        <main className="main-content">
          {/* All four stay mounted. The player owns a running AudioContext and
              a scheduler; unmounting it on a trip to the glossary would stop
              the music, which is the opposite of what a practice companion
              should do. */}
          <PlayerScreen active={screen === "player"} />
          <AnalyticsScreen active={screen === "analytics"} />
          <TaalScreen active={screen === "taal"} />
          <SettingsScreen active={screen === "settings"} />
        </main>

        <MobileNav navId={navId} onNavigate={navigate} />
      </div>

      {/* Outside .app-container on purpose: that element carries a
          backdrop-filter on desktop, which would make it the containing block
          for anything fixed inside it and trap these behind its rounded,
          clipped box. */}
      <div
        className={"app-scrim" + (anyOpen ? " open" : "")}
        onClick={() => closeOverlays()}
      />
      <Screensaver />
      <TilePicker />
      <ExitPrompt
        open={exitPromptOpen}
        onStay={() => setExitPromptOpen(false)}
        onExit={leaveApp}
      />
    </>
  );
}
