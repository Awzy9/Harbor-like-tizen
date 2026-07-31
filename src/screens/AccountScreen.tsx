import { useEffect, useState } from "react";
import { FocusableItem } from "@/components/FocusableItem";
import { FocusableTextField } from "@/components/FocusableTextField";
import { useAccountStore } from "@/state/accountStore";
import { accountService } from "@/stremio/account/accountServiceInstance";
import { addonManager } from "@/stremio/addon-client/addonManagerInstance";
import type { UserProfile } from "@/stremio/account/types";
import "./AccountScreen.css";

type Status = { kind: "idle" } | { kind: "busy"; label: string } | { kind: "error"; message: string } | { kind: "info"; message: string };

export function AccountScreen() {
  const { session, setSession } = useAccountStore();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [profile, setProfile] = useState<UserProfile | undefined>(undefined);

  useEffect(() => {
    if (!session) {
      setProfile(undefined);
      return;
    }
    accountService
      .getUserProfile()
      .then(setProfile)
      .catch(() => setProfile(undefined));
  }, [session]);

  async function handleLogin() {
    setStatus({ kind: "busy", label: "Logging in…" });
    try {
      const newSession = await accountService.login({ email, password });
      setSession(newSession);
      setPassword("");
      setStatus({ kind: "idle" });
    } catch (err) {
      setStatus({ kind: "error", message: err instanceof Error ? err.message : "Login failed" });
    }
  }

  async function handleLogout() {
    setStatus({ kind: "busy", label: "Logging out…" });
    await accountService.logout();
    setSession(undefined);
    setStatus({ kind: "idle" });
  }

  async function handlePullAddons() {
    setStatus({ kind: "busy", label: "Pulling add-ons from your Stremio account…" });
    try {
      const remote = await accountService.getInstalledAddons();
      let installed = 0;
      for (const addon of remote) {
        try {
          await addonManager.install(addon.transportUrl);
          installed++;
        } catch {
          // One bad remote entry (e.g. a since-removed add-on) shouldn't block the rest.
        }
      }
      setStatus({ kind: "info", message: `Installed ${installed} of ${remote.length} add-ons from your account.` });
    } catch (err) {
      setStatus({ kind: "error", message: err instanceof Error ? err.message : "Failed to pull add-ons" });
    }
  }

  async function handlePushAddons() {
    setStatus({ kind: "busy", label: "Pushing add-ons to your Stremio account…" });
    try {
      await accountService.syncAddons();
      setStatus({ kind: "info", message: "Your installed add-ons were pushed to your Stremio account." });
    } catch (err) {
      setStatus({ kind: "error", message: err instanceof Error ? err.message : "Failed to push add-ons" });
    }
  }

  if (!session) {
    return (
      <div className="account-screen">
        <h1>Link your Stremio account</h1>
        <p className="text-dim">
          Log in with your existing Stremio email and password to pull or push your installed add-ons.
        </p>
        <div className="account-screen__form">
          <FocusableTextField id="account-email" type="email" autoFocus value={email} onChange={setEmail} placeholder="Email" />
          <FocusableTextField id="account-password" type="password" value={password} onChange={setPassword} onSubmit={handleLogin} placeholder="Password" />
          <FocusableItem id="account-login" onEnter={handleLogin} disabled={status.kind === "busy"}>
            {status.kind === "busy" ? status.label : "Log In"}
          </FocusableItem>
        </div>
        {status.kind === "error" && <p className="account-screen__error">{status.message}</p>}
      </div>
    );
  }

  return (
    <div className="account-screen">
      <h1>Stremio Account</h1>
      <p className="text-dim">Signed in{profile?.email ? ` as ${profile.email}` : ""}.</p>

      <div className="account-screen__actions">
        <FocusableItem id="account-pull" autoFocus onEnter={handlePullAddons} disabled={status.kind === "busy"}>
          Pull add-ons from Stremio
        </FocusableItem>
        <FocusableItem id="account-push" onEnter={handlePushAddons} disabled={status.kind === "busy"}>
          Push add-ons to Stremio
        </FocusableItem>
        <FocusableItem id="account-logout" onEnter={handleLogout} disabled={status.kind === "busy"}>
          Log Out
        </FocusableItem>
      </div>

      {status.kind === "busy" && <p className="text-dim">{status.label}</p>}
      {status.kind === "error" && <p className="account-screen__error">{status.message}</p>}
      {status.kind === "info" && <p className="account-screen__info">{status.message}</p>}
    </div>
  );
}
