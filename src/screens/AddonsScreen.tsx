import { useState } from "react";
import { FocusableItem } from "@/components/FocusableItem";
import { FocusableTextField } from "@/components/FocusableTextField";
import { addonManager } from "@/stremio/addon-client/addonManagerInstance";
import type { InstalledAddon } from "@/types/addon";
import "./AddonsScreen.css";

// No add-ons are ever hard-coded here (docs/PROJECT_PLAN.md section 12) —
// every entry in the list below came from a manifest URL the user installed
// themselves, either through this screen or (once implemented) account sync.
export function AddonsScreen() {
  const [addons, setAddons] = useState<InstalledAddon[]>(() => addonManager.list());
  const [url, setUrl] = useState("");
  const [status, setStatus] = useState<{ kind: "idle" | "installing" | "error"; message?: string }>({ kind: "idle" });

  async function handleInstall() {
    const trimmed = url.trim();
    if (!trimmed) return;

    setStatus({ kind: "installing" });
    try {
      await addonManager.install(trimmed);
      setAddons(addonManager.list());
      setUrl("");
      setStatus({ kind: "idle" });
    } catch (err) {
      setStatus({ kind: "error", message: err instanceof Error ? err.message : "Failed to install add-on" });
    }
  }

  function handleRemove(transportUrl: string) {
    addonManager.remove(transportUrl);
    setAddons(addonManager.list());
  }

  function handleToggle(addon: InstalledAddon) {
    addonManager.setEnabled(addon.transportUrl, !addon.enabled);
    setAddons(addonManager.list());
  }

  return (
    <div className="addons-screen">
      <h2>Install an add-on</h2>
      <div className="addons-screen__install-row">
        <FocusableTextField
          id="addon-url-input"
          value={url}
          onChange={setUrl}
          onSubmit={handleInstall}
          placeholder="https://example.com/manifest.json"
        />
        <FocusableItem id="addon-install-button" onEnter={handleInstall} disabled={status.kind === "installing"}>
          {status.kind === "installing" ? "Installing…" : "Install"}
        </FocusableItem>
      </div>
      {status.kind === "error" && <p className="addons-screen__error">{status.message}</p>}

      <h2>Installed add-ons</h2>
      {addons.length === 0 && <p className="text-dim">No add-ons installed yet.</p>}
      <ul className="addons-screen__list">
        {addons.map((addon) => (
          <li key={addon.transportUrl} className="addons-screen__row">
            <FocusableItem
              id={`addon-toggle-${addon.transportUrl}`}
              className="addons-screen__toggle"
              onEnter={() => handleToggle(addon)}
              selected={addon.enabled}
            >
              <div className="addons-screen__name">{addon.manifest.name}</div>
              <div className="text-dim addons-screen__meta">
                v{addon.manifest.version} · {addon.enabled ? "enabled" : "disabled"} · {addon.manifest.types.join(", ")}
              </div>
            </FocusableItem>
            <FocusableItem
              id={`addon-remove-${addon.transportUrl}`}
              className="addons-screen__remove"
              onEnter={() => handleRemove(addon.transportUrl)}
            >
              Remove
            </FocusableItem>
          </li>
        ))}
      </ul>
    </div>
  );
}
