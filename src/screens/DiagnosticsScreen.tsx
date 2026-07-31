import { useEffect, useMemo, useState } from "react";
import { FocusableItem } from "@/components/FocusableItem";
import { getDeviceCapabilities } from "@/tizen/deviceCapabilities";
import { addonManager } from "@/stremio/addon-client/addonManagerInstance";
import { useAccountStore } from "@/state/accountStore";
import { logger, type LogEntry } from "@/services/logger";
import { runPlaybackProbe, type PlaybackProbeResult } from "@/player/runPlaybackProbe";
import { TEST_STREAMS } from "@/player/testStreams";
import { srtToVtt } from "@/stremio/subtitles/srtToVtt";
import "./DiagnosticsScreen.css";

type PingResult = { name: string; ok: boolean; detail: string };

const PING_TIMEOUT_MS = 5000;

function Check({ ok }: { ok: boolean }) {
  return <span className={ok ? "diagnostics-check diagnostics-check--yes" : "diagnostics-check diagnostics-check--no"}>{ok ? "✓" : "✗"}</span>;
}

export function DiagnosticsScreen() {
  const capabilities = useMemo(() => getDeviceCapabilities(), []);
  const session = useAccountStore((s) => s.session);
  const addons = addonManager.list();

  const [networkResults, setNetworkResults] = useState<PingResult[] | undefined>(undefined);
  const [networkRunning, setNetworkRunning] = useState(false);
  const [playbackResults, setPlaybackResults] = useState<Record<string, PlaybackProbeResult>>({});
  const [playbackRunning, setPlaybackRunning] = useState<string | undefined>(undefined);
  const [subtitleResult, setSubtitleResult] = useState<PingResult | undefined>(undefined);
  const [logEntries, setLogEntries] = useState<LogEntry[]>(() => logger.getEntries());

  useEffect(() => logger.subscribe(() => setLogEntries(logger.getEntries())), []);

  async function testNetwork() {
    setNetworkRunning(true);
    setNetworkResults(undefined);
    if (addons.length === 0) {
      setNetworkResults([{ name: "(no add-ons installed)", ok: false, detail: "Install an add-on to test reachability" }]);
      setNetworkRunning(false);
      return;
    }

    const results = await Promise.all(
      addons.map(async (addon): Promise<PingResult> => {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), PING_TIMEOUT_MS);
        const started = performance.now();
        try {
          const res = await fetch(addon.transportUrl, { signal: controller.signal });
          const elapsed = Math.round(performance.now() - started);
          return { name: addon.manifest.name, ok: res.ok, detail: `${res.status} in ${elapsed}ms` };
        } catch (err) {
          return { name: addon.manifest.name, ok: false, detail: err instanceof Error ? err.message : String(err) };
        } finally {
          clearTimeout(timeout);
        }
      }),
    );
    setNetworkResults(results);
    setNetworkRunning(false);
  }

  async function testStream(protocol: "direct" | "hls" | "dash") {
    const stream = TEST_STREAMS.find((s) => s.kind === "url" && s.protocol === protocol);
    if (!stream) return;
    setPlaybackRunning(stream.label);
    const result = await runPlaybackProbe(stream);
    setPlaybackResults((prev) => ({ ...prev, [protocol]: result }));
    setPlaybackRunning(undefined);
    logger.info(`Diagnostics: ${stream.label} ${result.passed ? "passed" : "failed"}`, result.detail);
  }

  function testSubtitles() {
    const sample = "1\n00:00:01,000 --> 00:00:02,500\nHello, world!\n";
    try {
      const vtt = srtToVtt(sample);
      const ok = vtt.startsWith("WEBVTT") && vtt.includes("00:00:01.000 --> 00:00:02.500");
      setSubtitleResult({ name: "SRT → WebVTT", ok, detail: ok ? "Conversion produced valid WebVTT" : "Unexpected output" });
    } catch (err) {
      setSubtitleResult({ name: "SRT → WebVTT", ok: false, detail: err instanceof Error ? err.message : String(err) });
    }
  }

  function clearLogs() {
    logger.clear();
    setLogEntries(logger.getEntries());
  }

  return (
    <div className="diagnostics-screen">
      <h1>Diagnostics</h1>

      <section className="diagnostics-section">
        <h2>Device</h2>
        <dl className="diagnostics-grid">
          <dt>Platform</dt>
          <dd>{capabilities.isTizen ? "Samsung Tizen TV" : "Desktop browser (Tizen APIs unavailable)"}</dd>
          <dt>Tizen version</dt>
          <dd>{capabilities.tizenVersion ?? "—"}</dd>
          <dt>Model</dt>
          <dd>{capabilities.model ?? "unknown (not exposed outside real Samsung firmware)"}</dd>
          <dt>Screen</dt>
          <dd>{capabilities.screenWidth} × {capabilities.screenHeight}</dd>
        </dl>
      </section>

      <section className="diagnostics-section">
        <h2>Video codecs</h2>
        <dl className="diagnostics-grid">
          <dt>H.264</dt><dd><Check ok={capabilities.codecs.h264} /></dd>
          <dt>HEVC</dt><dd><Check ok={capabilities.codecs.hevc} /></dd>
          <dt>VP9</dt><dd><Check ok={capabilities.codecs.vp9} /></dd>
          <dt>AV1</dt><dd><Check ok={capabilities.codecs.av1} /></dd>
          <dt>HLS</dt><dd><Check ok={capabilities.supportsHLS} /></dd>
          <dt>DASH (via dash.js)</dt><dd><Check ok={capabilities.supportsDASH} /></dd>
        </dl>
      </section>

      <section className="diagnostics-section">
        <h2>Audio codecs</h2>
        <dl className="diagnostics-grid">
          <dt>AAC</dt><dd><Check ok={capabilities.audioCodecs.aac} /></dd>
          <dt>AC-3</dt><dd><Check ok={capabilities.audioCodecs.ac3} /></dd>
          <dt>E-AC-3</dt><dd><Check ok={capabilities.audioCodecs.eac3} /></dd>
          <dt>Opus</dt><dd><Check ok={capabilities.audioCodecs.opus} /></dd>
        </dl>
      </section>

      <section className="diagnostics-section">
        <h2>HDR</h2>
        <dl className="diagnostics-grid">
          <dt>HDR10</dt><dd><Check ok={capabilities.supportsHDR10} /></dd>
          <dt>Dolby Vision</dt>
          <dd>{capabilities.supportsDolbyVisionUnconfirmed ? "maybe (unconfirmed — no reliable browser API)" : "no signal"}</dd>
        </dl>
      </section>

      <section className="diagnostics-section">
        <h2>Network</h2>
        <dl className="diagnostics-grid">
          <dt>Connected</dt><dd><Check ok={capabilities.network.online} /></dd>
          <dt>Connection type</dt><dd>{capabilities.network.effectiveType ?? "not reported by this platform"}</dd>
          <dt>Estimated downlink</dt><dd>{capabilities.network.downlinkMbps !== undefined ? `${capabilities.network.downlinkMbps} Mbps` : "—"}</dd>
          <dt>Estimated latency</dt><dd>{capabilities.network.rttMs !== undefined ? `${capabilities.network.rttMs} ms` : "—"}</dd>
        </dl>
      </section>

      <section className="diagnostics-section">
        <h2>Account</h2>
        <dl className="diagnostics-grid">
          <dt>Authenticated</dt><dd><Check ok={session !== undefined} /></dd>
          <dt>Add-ons installed</dt><dd>{addons.length}</dd>
        </dl>
      </section>

      <section className="diagnostics-section">
        <h2>Tests</h2>
        <div className="diagnostics-actions">
          <FocusableItem id="diag-test-network" autoFocus onEnter={testNetwork}>
            {networkRunning ? "Testing…" : "Test Network"}
          </FocusableItem>
          <FocusableItem id="diag-test-video" onEnter={() => testStream("direct")}>
            {playbackRunning === "WebM (local sample)" ? "Testing…" : "Test Video"}
          </FocusableItem>
          <FocusableItem id="diag-test-hls" onEnter={() => testStream("hls")}>
            {playbackRunning?.startsWith("HLS") ? "Testing…" : "Test HLS"}
          </FocusableItem>
          <FocusableItem id="diag-test-dash" onEnter={() => testStream("dash")}>
            {playbackRunning?.startsWith("DASH") ? "Testing…" : "Test DASH"}
          </FocusableItem>
          <FocusableItem id="diag-test-subtitles" onEnter={testSubtitles}>
            Test Subtitles
          </FocusableItem>
          <FocusableItem id="diag-clear-logs" onEnter={clearLogs}>
            Clear Logs
          </FocusableItem>
        </div>

        {networkResults && (
          <ul className="diagnostics-results">
            {networkResults.map((r) => (
              <li key={r.name}><Check ok={r.ok} /> {r.name} — {r.detail}</li>
            ))}
          </ul>
        )}
        {(["direct", "hls", "dash"] as const).map((protocol) => {
          const result = playbackResults[protocol];
          if (!result) return null;
          return (
            <p key={protocol} className="diagnostics-results">
              <Check ok={result.passed} /> {result.label} — {result.detail} ({Math.round(result.durationMs)}ms)
            </p>
          );
        })}
        {subtitleResult && (
          <p className="diagnostics-results">
            <Check ok={subtitleResult.ok} /> {subtitleResult.name} — {subtitleResult.detail}
          </p>
        )}
      </section>

      <section className="diagnostics-section">
        <h2>Logs ({logEntries.length})</h2>
        <ul className="diagnostics-log-list">
          {logEntries.length === 0 && <li className="text-dim">No log entries yet.</li>}
          {logEntries
            .slice()
            .reverse()
            .slice(0, 30)
            .map((entry, i) => (
              <li key={i} className={`diagnostics-log-entry diagnostics-log-entry--${entry.level}`}>
                [{entry.level}] {entry.message}
              </li>
            ))}
        </ul>
      </section>
    </div>
  );
}
