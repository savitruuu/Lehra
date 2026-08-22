import { useUI } from "../ui/UIContext.jsx";

const ICONS = {
  play: "M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14.5v-9l6 4.5-6 4.5z",
  tabla:
    "M12,2A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2M12,4A8,8 0 0,1 20,12C20,14.4 18.9,16.5 17.2,18H6.8C5.1,16.5 4,14.4 4,12A8,8 0 0,1 12,4M12,6A6,6 0 0,0 6,12A6,6 0 0,0 12,18A6,6 0 0,0 18,12A6,6 0 0,0 12,6M12,8A4,4 0 0,1 16,12A4,4 0 0,1 12,16A4,4 0 0,1 8,12A4,4 0 0,1 12,8Z",
  chart:
    "M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zM9 17H7v-7h2v7zm4 0h-2V7h2v10zm4 0h-2v-4h2v4z",
  info: "M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z",
  gear: "M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z",
  menu: "M3 6h18v2H3V6zm0 5h18v2H3v-2zm0 5h18v2H3v-2z",
  close: "M19 6.41 17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"
};

function Icon({ name }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d={ICONS[name]} />
    </svg>
  );
}

/**
 * The drawer's five destinations.
 *
 * Lehra and Tabla are the same screen with two doors: whichever was tapped
 * decides which side of it is showing. They are told apart by `id` rather than
 * by their target, which is why the target alone cannot drive the active state.
 */
const NAV_ITEMS = [
  { id: "player", target: "player", icon: "play", label: "Lehra", tablaMode: false },
  { id: "tabla", target: "player", icon: "tabla", label: "Tabla", tablaMode: true },
  { id: "analytics", target: "analytics", icon: "chart", label: "Practice Analytics" },
  { id: "taal", target: "taal", icon: "info", label: "Taal Information" },
  { id: "settings", target: "settings", icon: "gear", label: "Settings" }
];

const MOBILE_NAV_ITEMS = [
  { id: "player", target: "player", icon: "play", label: "Player" },
  { id: "analytics", target: "analytics", icon: "chart", label: "Stats" },
  { id: "taal", target: "taal", icon: "info", label: "Glossary" },
  { id: "settings", target: "settings", icon: "gear", label: "Prefs" }
];

export function BrandMark({ size = 24 }) {
  return (
    <svg viewBox="0 0 24 24" style={{ width: size, height: size }}>
      <path d={ICONS.tabla} />
    </svg>
  );
}

export function Drawer({ navId, onNavigate }) {
  const { drawerOpen, closeOverlays } = useUI();

  return (
    <aside className={"sidebar" + (drawerOpen ? " open" : "")} id="app-drawer">
      <div>
        <button
          className="drawer-close-btn"
          onClick={() => closeOverlays()}
          aria-label="Close menu"
        >
          <Icon name="close" />
        </button>

        <div className="brand">
          <div className="brand-logo">
            <BrandMark />
          </div>
          <span className="brand-name">Lehra</span>
        </div>

        <nav>
          <ul className="nav-menu">
            {NAV_ITEMS.map((item) => (
              <li
                key={item.id}
                className={"nav-item" + (navId === item.id ? " active" : "")}
                onClick={() => {
                  onNavigate(item);
                  closeOverlays();
                }}
              >
                <Icon name={item.icon} />
                <span>{item.label}</span>
              </li>
            ))}
          </ul>
        </nav>

        {/* Empty now that the record button and the practice-timer dropdown are
            gone - it hides itself with :empty, and is left in place as the slot
            for anything the player card cannot hold in future. */}
        <div className="drawer-extras" />
      </div>
      <div>
        <p style={{ fontSize: 12, color: "var(--text-muted)", textAlign: "center" }}>
          Lehra v1.0.0 (Web)
        </p>
      </div>
    </aside>
  );
}

export function MobileHeader() {
  const { openDrawer, drawerOpen } = useUI();

  return (
    <header className="mobile-header">
      <button
        className="mobile-menu-btn"
        onClick={openDrawer}
        aria-label="Open menu"
        aria-expanded={drawerOpen}
        aria-controls="app-drawer"
      >
        <Icon name="menu" />
      </button>
      <div className="brand">
        <div className="brand-logo" style={{ width: 32, height: 32 }}>
          <BrandMark size={18} />
        </div>
        <span className="brand-name" style={{ fontSize: 18 }}>
          Lehra
        </span>
      </div>
    </header>
  );
}

export function MobileNav({ navId, onNavigate }) {
  return (
    <nav className="mobile-nav">
      {MOBILE_NAV_ITEMS.map((item) => (
        <a
          key={item.id}
          className={"mobile-nav-item" + (navId === item.id ? " active" : "")}
          onClick={() => onNavigate(item)}
        >
          <Icon name={item.icon} />
          <span>{item.label}</span>
        </a>
      ))}
    </nav>
  );
}
