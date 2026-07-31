import { TizenVideoPlayer } from "./TizenVideoPlayer";
import type { TestStream } from "./testStreams";

export interface PlaybackProbeResult {
  label: string;
  passed: boolean;
  detail: string;
  durationMs: number;
}

const PROBE_TIMEOUT_MS = 12000;

/**
 * Headlessly attempts one test stream against a real (off-screen)
 * TizenVideoPlayer and reports pass/fail — used by the Diagnostics screen's
 * "Test Video/HLS/DASH" buttons so they exercise the exact same playback
 * path production streams use, not a separate re-implementation.
 */
export async function runPlaybackProbe(stream: TestStream): Promise<PlaybackProbeResult> {
  const container = document.createElement("div");
  container.style.cssText = "position:fixed;width:1px;height:1px;overflow:hidden;opacity:0;pointer-events:none;";
  document.body.appendChild(container);

  const player = new TizenVideoPlayer(container);
  const started = performance.now();

  try {
    const outcome = await new Promise<{ passed: boolean; detail: string }>((resolve) => {
      const timeout = setTimeout(() => resolve({ passed: false, detail: `Timed out after ${PROBE_TIMEOUT_MS / 1000}s` }), PROBE_TIMEOUT_MS);

      const unsubscribe = player.onStatusChange((state) => {
        if (state.status === "playing") {
          clearTimeout(timeout);
          unsubscribe();
          resolve({ passed: true, detail: "Playback started" });
        } else if (state.status === "error") {
          clearTimeout(timeout);
          unsubscribe();
          resolve({ passed: false, detail: state.error?.detail ?? state.error?.message ?? "Unknown error" });
        }
      });

      if (stream.kind === "torrent") {
        player.loadTorrent(stream.infoHash, undefined, stream.sources);
      } else {
        player.load(stream.url);
      }
      player.play();
    });

    return { label: stream.label, passed: outcome.passed, detail: outcome.detail, durationMs: performance.now() - started };
  } finally {
    player.destroy();
    container.remove();
  }
}
