import { FocusableItem } from "@/components/FocusableItem";
import { getDeviceInfo } from "@/tizen/device";
import "./SettingsScreen.css";

const SETTINGS_ITEMS = [
  "Account",
  "Add-ons",
  "Playback",
  "Subtitles",
  "About",
];

export function SettingsScreen() {
  const device = getDeviceInfo();

  return (
    <div className="settings-screen">
      <ul className="settings-list">
        {SETTINGS_ITEMS.map((label) => (
          <FocusableItem key={label} id={`settings-${label}`} className="settings-item">
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
