import type WebTorrentInstance from "webtorrent";

const METADATA_TIMEOUT_MS = 25000;
const VIDEO_EXTENSIONS = [".mp4", ".mkv", ".webm", ".m4v", ".avi", ".mov"];

/**
 * Plays infoHash-based Stremio streams via WebTorrent, rendering the picked
 * file directly into an existing <video> element.
 *
 * Browser WebTorrent has no DHT — its "browser" package.json field disables
 * bittorrent-dht entirely, so peer discovery here depends solely on WSS
 * (WebSocket Secure) trackers and WebSeeds reachable from a browser context.
 * Most Stremio add-ons list plain udp:// tracker hints meant for native
 * BitTorrent clients; those are silently unusable here. This is an inherent
 * limitation of running BitTorrent in a browser/WebView, not a bug in this
 * wrapper — it's why torrent streams are ranked below direct HTTP streams
 * (see StreamRanker) and why a hard timeout exists below: without one, a
 * torrent with no reachable WSS peers would leave the UI stuck on "loading"
 * forever instead of surfacing a real error.
 */
export class TorrentStreamManager {
  private client: WebTorrentInstance.Instance | undefined;
  private destroyed = false;

  async render(video: HTMLVideoElement, infoHash: string, fileIdx: number | undefined, sources: string[] | undefined): Promise<void> {
    const { default: WebTorrent } = await import("webtorrent");
    if (this.destroyed) return;

    const client = new WebTorrent();
    this.client = client;

    return new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error("Timed out finding peers (browser BitTorrent has no DHT — only WSS trackers/WebSeeds work)."));
      }, METADATA_TIMEOUT_MS);

      const fail = (err: unknown) => {
        clearTimeout(timeout);
        reject(err instanceof Error ? err : new Error(String(err)));
      };

      client.on("error", fail);

      client.add(buildMagnetUri(infoHash, sources), (torrent) => {
        if (this.destroyed) return;
        const file = pickVideoFile(torrent.files, fileIdx);
        if (!file) {
          fail(new Error("No playable video file found in this torrent."));
          return;
        }
        file.renderTo(video, { autoplay: false }, (err) => {
          clearTimeout(timeout);
          if (err) reject(err instanceof Error ? err : new Error(String(err)));
          else resolve();
        });
      });
    });
  }

  destroy(): void {
    this.destroyed = true;
    if (this.client) {
      this.client.destroy();
      this.client = undefined;
    }
  }
}

/**
 * Builds a magnet URI from a Stremio infoHash + `sources` hints. Per the
 * add-on protocol, `sources` entries are prefixed "tracker:" (an announce
 * URL) or "dht:" (a DHT bootstrap node) — the latter is meaningless here
 * since browser WebTorrent has no DHT, so it's dropped rather than passed
 * through as a bogus tracker.
 *
 * Built by hand rather than via URLSearchParams: real magnet links leave the
 * "urn:btih:" prefix in `xt` unencoded, but URLSearchParams percent-encodes
 * every colon (`xt=urn%3Abtih%3A...`), which parse-torrent's magnet-uri
 * parser rejects outright as "Invalid torrent identifier".
 */
function buildMagnetUri(infoHash: string, sources: string[] | undefined): string {
  const params = [`xt=urn:btih:${infoHash}`];
  for (const source of sources ?? []) {
    if (source.startsWith("tracker:")) params.push(`tr=${encodeURIComponent(source.slice("tracker:".length))}`);
    else if (!source.startsWith("dht:")) params.push(`tr=${encodeURIComponent(source)}`);
  }
  return `magnet:?${params.join("&")}`;
}

function pickVideoFile(files: WebTorrentInstance.TorrentFile[], fileIdx: number | undefined): WebTorrentInstance.TorrentFile | undefined {
  if (fileIdx !== undefined && files[fileIdx]) return files[fileIdx];
  const videoFiles = files.filter((f) => VIDEO_EXTENSIONS.some((ext) => f.name.toLowerCase().endsWith(ext)));
  const pool = videoFiles.length > 0 ? videoFiles : files;
  return pool.reduce<WebTorrentInstance.TorrentFile | undefined>(
    (largest, f) => (!largest || f.length > largest.length ? f : largest),
    undefined,
  );
}
