import { FocusableItem } from "@/components/FocusableItem";
import type { MetaPreview } from "@/stremio/addon-client/types";
import "./PosterTile.css";

interface PosterTileProps {
  id: string;
  meta: MetaPreview;
  onEnter: () => void;
}

export function PosterTile({ id, meta, onEnter }: PosterTileProps) {
  return (
    <FocusableItem id={id} className="poster-tile" onEnter={onEnter}>
      {meta.poster ? (
        <img className="poster-tile__image" src={meta.poster} alt="" loading="lazy" />
      ) : (
        <div className="poster-tile__fallback">{meta.name}</div>
      )}
      <span className="poster-tile__label">{meta.name}</span>
    </FocusableItem>
  );
}
