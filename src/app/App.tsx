import { FocusProvider, useBackHandler } from "@/navigation/FocusManager";
import { FocusableItem } from "@/components/FocusableItem";
import { useNavigationStore, type ScreenId } from "@/state/navigationStore";
import { exitApplication } from "@/tizen/lifecycle";
import { HomeScreen } from "@/screens/HomeScreen";
import { SettingsScreen } from "@/screens/SettingsScreen";
import { TestPlayerScreen } from "@/screens/TestPlayerScreen";
import { TestRemoteScreen } from "@/screens/TestRemoteScreen";
import "./App.css";

const NAV_ITEMS: Array<{ id: ScreenId; label: string }> = [
  { id: "home", label: "Home" },
  { id: "testRemote", label: "Test Remote" },
  { id: "testPlayer", label: "Test Player" },
  { id: "settings", label: "Settings" },
];

function Shell() {
  const { screen, goTo } = useNavigationStore();

  // Back returns to Home first, then exits from Home — on a real TV, exiting
  // is the only way back to Smart Hub, so it must never be a dead end, but
  // it also shouldn't be the *first* thing Back does from every screen.
  useBackHandler(() => (screen === "home" ? exitApplication() : goTo("home")));

  return (
    <div className="app-shell">
      <nav className="app-nav safe-area" aria-label="Main navigation">
        {NAV_ITEMS.map((item, index) => (
          <FocusableItem
            key={item.id}
            id={`nav-${item.id}`}
            autoFocus={index === 0}
            selected={screen === item.id}
            onEnter={() => goTo(item.id)}
          >
            <span className="app-nav__label">{item.label}</span>
          </FocusableItem>
        ))}
      </nav>
      <main className="app-content">{renderScreen(screen)}</main>
    </div>
  );
}

function renderScreen(screen: ScreenId) {
  switch (screen) {
    case "home":
      return <HomeScreen />;
    case "settings":
      return <SettingsScreen />;
    case "testPlayer":
      return <TestPlayerScreen />;
    case "testRemote":
      return <TestRemoteScreen />;
  }
}

export function App() {
  return (
    <FocusProvider>
      <Shell />
    </FocusProvider>
  );
}
