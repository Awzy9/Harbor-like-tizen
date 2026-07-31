import { FocusableItem } from "@/components/FocusableItem";
import { getDeviceInfo } from "@/tizen/device";
import { useNavigationStore, type Screen } from "@/state/navigationStore";
import { useAccountStore } from "@/state/accountStore";
import "./SettingsScreen.css";

const INERT_SETTINGS_ITEMS = ["Playback", "Subtitles", "About"];

const DEV_TOOLS: Array<{ label: string; screen: Screen }> = [
  { label: "Test Remote Navigation", screen: { name: "testRemote" } },
  { label: "Test Player", screen: { name: "testPlayer" } },
  { label: "Diagnostics", screen: { name: "diagnostics" } },
];

export function SettingsScreen() {
  const device = getDeviceInfo();
  const goTo = useNavigationStore((s) => s.goTo);
  const session = useAccountStore((s) => s.session);

  return (
    <div className="settings-screen">
      <ul className="settings-list">
        <FocusableItem id="settings-account" className="settings-item" autoFocus onEnter={() => goTo({ name: "account" })}>
          Account{session ? " — Signed in" : ""}
        </FocusableItem>
        {INERT_SETTINGS_ITEMS.map((label) => (
          <FocusableItem key={label} id={`settings-${label}`} className="settings-item">
            {label}
          </FocusableItem>
        ))}
      </ul>

      <h2>Developer Tools</h2>
      <ul className="settings-list">
        {DEV_TOOLS.map(({ label, screen }) => (
          <FocusableItem key={label} id={`settings-devtool-${label}`} className="settings-item" onEnter={() => goTo(screen)}>
            {label}
          </FocusableItem>
        ))}
      </ul>

      <p className="text-dim settings-device-info">
        {device.isTizen
          ? `Running on Tizen ${device.platformVersion ?? "(unknown version)"}`
          : "Running in a desktop browser (Tizen APIs unavailable)"}
      </p>
    </div>
  );
}
