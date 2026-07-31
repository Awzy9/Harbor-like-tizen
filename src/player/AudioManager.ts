import type { AudioTrackInfo } from "@/types/player";

/**
 * Thin wrapper around HTMLMediaElement.audioTracks. Only ever reports tracks
 * the platform actually exposes — docs/PROJECT_PLAN.md section 24 is
 * explicit that audio-track lists must never be fabricated. Most desktop
 * browsers don't implement this API at all, in which case this correctly
 * reports zero tracks rather than guessing.
 */
export function listAudioTracks(video: HTMLVideoElement): AudioTrackInfo[] {
  const tracks = video.audioTracks;
  if (!tracks) return [];

  const result: AudioTrackInfo[] = [];
  for (let i = 0; i < tracks.length; i++) {
    const track = tracks[i];
    result.push({ id: track.id, label: track.label || track.language || `Track ${i + 1}`, language: track.language });
  }
  return result;
}

export function selectAudioTrack(video: HTMLVideoElement, trackId: string): void {
  const tracks = video.audioTracks;
  if (!tracks) return;

  for (let i = 0; i < tracks.length; i++) {
    tracks[i].enabled = tracks[i].id === trackId;
  }
}
