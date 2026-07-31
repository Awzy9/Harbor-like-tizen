// HTMLMediaElement.audioTracks (the WHATWG "media multitrack" AudioTrackList
// API) is implemented by Tizen's WebKit and Chromium but isn't part of
// TypeScript's DOM lib, so it needs its own ambient declaration.

export {};

declare global {
  interface AudioTrack {
    id: string;
    kind: string;
    label: string;
    language: string;
    enabled: boolean;
  }

  interface AudioTrackList extends EventTarget {
    readonly length: number;
    [index: number]: AudioTrack;
  }

  interface HTMLMediaElement {
    readonly audioTracks?: AudioTrackList;
  }
}
