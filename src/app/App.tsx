import { FocusProvider, useBackHandler } from "@/navigation/FocusManager";
import { ErrorBoundary } from "./ErrorBoundary";
import { FocusableItem } from "@/components/FocusableItem";
import { useNavigationStore, type Screen, type ScreenName } from "@/state/navigationStore";
import { exitApplication } from "@/tizen/lifecycle";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { HomeScreen } from "@/screens/HomeScreen";
import { SettingsScreen } from "@/screens/SettingsScreen";
import { TestPlayerScreen } from "@/screens/TestPlayerScreen";
import { TestRemoteScreen } from "@/screens/TestRemoteScreen";
import { DiagnosticsScreen } from "@/screens/DiagnosticsScreen";
import { AddonsScreen } from "@/screens/AddonsScreen";
import { SearchScreen } from "@/screens/SearchScreen";
import { DetailsScreen } from "@/screens/DetailsScreen";
import { StreamSelectionScreen } from "@/screens/StreamSelectionScreen";
import { PlayerScreen } from "@/screens/PlayerScreen";
import { AccountScreen } from "@/screens/AccountScreen";
import "./App.css";

const NAV_ITEMS: Array<{ name: ScreenName; label: string }> = [
  { name: "home", label: "Home" },
  { name: "search", label: "Search" },
  { name: "addons", label: "Add-ons" },
  { name: "settings", label: "Settings" },
];

// Screens reachable only by drilling in from another screen (not top-level
// nav) fall back to Home on Back rather than whatever top-level tab happened
// to be selected last.
const DRILL_IN_SCREENS: ScreenName[] = ["details", "streamSelect", "player", "testPlayer", "testRemote", "diagnostics", "account"];

function Shell() {
  const { screen, goTo } = useNavigationStore();
  const online = useOnlineStatus();

  // Back returns to Home first, then exits from Home — on a real TV, exiting
  // is the only way back to Smart Hub, so it must never be a dead end, but
  // it also shouldn't be the *first* thing Back does from every screen.
  useBackHandler(() => (screen.name === "home" ? exitApplication() : goTo({ name: "home" })));

  return (
    <div className="app-shell">
      {!online && screen.name !== "player" && (
        <div className="app-offline-banner" role="status">
          You&apos;re offline — showing cached content where available.
        </div>
      )}
      {!DRILL_IN_SCREENS.includes(screen.name) && (
        <nav className="app-nav safe-area" aria-label="Main navigation">
          {NAV_ITEMS.map((item, index) => (
            <FocusableItem
              key={item.name}
              id={`nav-${item.name}`}
              autoFocus={index === 0}
              selected={screen.name === item.name}
              onEnter={() => goTo({ name: item.name } as Screen)}
            >
              <span className="app-nav__label">{item.label}</span>
            </FocusableItem>
          ))}
        </nav>
      )}
      <main className="app-content">
        {/* Keyed by screen identity so navigating away from a screen that
            crashed remounts a fresh boundary instead of staying stuck on
            the "Try again" fallback for whatever screen died. */}
        <ErrorBoundary key={screenKey(screen)}>{renderScreen(screen)}</ErrorBoundary>
      </main>
    </div>
  );
}

function screenKey(screen: Screen): string {
  switch (screen.name) {
    case "details":
    case "streamSelect":
      return `${screen.name}:${screen.id}`;
    case "player":
      return `${screen.name}:${screen.contentId}:${screen.episodeId ?? ""}`;
    default:
      return screen.name;
  }
}

function renderScreen(screen: Screen) {
  switch (screen.name) {
    case "home":
      return <HomeScreen />;
    case "search":
      return <SearchScreen />;
    case "addons":
      return <AddonsScreen />;
    case "settings":
      return <SettingsScreen />;
    case "account":
      return <AccountScreen />;
    case "testPlayer":
      return <TestPlayerScreen />;
    case "testRemote":
      return <TestRemoteScreen />;
    case "diagnostics":
      return <DiagnosticsScreen />;
    case "details":
      return <DetailsScreen addonUrl={screen.addonUrl} type={screen.type} id={screen.id} />;
    case "streamSelect":
      return (
        <StreamSelectionScreen
          addonUrl={screen.addonUrl}
          type={screen.type}
          id={screen.id}
          title={screen.title}
          poster={screen.poster}
          nextEpisode={screen.nextEpisode}
        />
      );
    case "player":
      return (
        <PlayerScreen
          streams={screen.streams}
          addonUrl={screen.addonUrl}
          contentId={screen.contentId}
          episodeId={screen.episodeId}
          title={screen.title}
          poster={screen.poster}
          type={screen.type}
          nextEpisode={screen.nextEpisode}
        />
      );
  }
}

export function App() {
  return (
    <ErrorBoundary>
      <FocusProvider>
        <Shell />
      </FocusProvider>
    </ErrorBoundary>
  );
}
