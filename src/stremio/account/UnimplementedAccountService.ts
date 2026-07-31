import type { StremioAccountService } from "./types";

/**
 * Placeholder implementation so the rest of the app can depend on
 * StremioAccountService today without account linking existing yet. Every
 * method rejects — callers must treat "no account service implemented" as a
 * first-class, expected state (show a "link your account" screen), not a
 * bug to be silently swallowed.
 */
export class UnimplementedAccountService implements StremioAccountService {
  private fail(method: string): Error {
    return new Error(
      `StremioAccountService.${method}() is not implemented yet — see docs/PROJECT_PLAN.md section 13/59.`,
    );
  }

  login(): Promise<never> {
    return Promise.reject(this.fail("login"));
  }

  logout(): Promise<never> {
    return Promise.reject(this.fail("logout"));
  }

  getInstalledAddons(): Promise<never> {
    return Promise.reject(this.fail("getInstalledAddons"));
  }

  getLibrary(): Promise<never> {
    return Promise.reject(this.fail("getLibrary"));
  }

  syncAddons(): Promise<never> {
    return Promise.reject(this.fail("syncAddons"));
  }

  getUserProfile(): Promise<never> {
    return Promise.reject(this.fail("getUserProfile"));
  }
}
