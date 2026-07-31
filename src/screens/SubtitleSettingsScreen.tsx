import { useState } from "react";
import { FocusableItem } from "@/components/FocusableItem";
import { getSubtitleSettings, cycleSubtitleFontSize, setSubtitleBackground, setPreferredSubtitleLanguage } from "@/storage/subtitleSettings";
import "./SubtitleSettingsScreen.css";

export function SubtitleSettingsScreen() {
  const [settings, setSettings] = useState(getSubtitleSettings);

  function cycleFontSize() {
    setSettings(cycleSubtitleFontSize());
  }

  function toggleBackground() {
    setSettings(setSubtitleBackground(!settings.background));
  }

  function forgetLanguage() {
    setPreferredSubtitleLanguage("off");
    setSettings((prev) => ({ ...prev, preferredLanguage: "off" }));
  }

  return (
    <div className="subtitle-settings-screen">
      <h1>Subtitle Settings</h1>
      <ul className="settings-list">
        <FocusableItem id="subtitle-settings-size" className="settings-item" autoFocus onEnter={cycleFontSize}>
          Font Size: {settings.fontSize}
        </FocusableItem>
        <FocusableItem id="subtitle-settings-background" className="settings-item" onEnter={toggleBackground}>
          Background: {settings.background ? "On" : "Off"}
        </FocusableItem>
        {settings.preferredLanguage !== "off" && (
          <FocusableItem id="subtitle-settings-forget" className="settings-item" onEnter={forgetLanguage}>
            Forget Remembered Language ({settings.preferredLanguage})
          </FocusableItem>
        )}
      </ul>
      <p className="text-dim subtitle-settings-screen__note">
        {settings.preferredLanguage === "off"
          ? "No subtitle language remembered yet — pick one from the Player's Subtitles panel and it'll auto-apply next time."
          : `Automatically applied when available: ${settings.preferredLanguage}.`}
        {" "}Sync delay is adjusted per-title from the Player's Subtitles panel, since offsets are usually specific to one stream, not a global preference.
      </p>
    </div>
  );
}
