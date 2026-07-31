import { FocusableItem } from "@/components/FocusableItem";
import type { MetaPreview } from "@/stremio/addon-client/types";
import "./PosterTile.css";

interface PosterTileProps {
  id: string;
  meta: MetaPreview;
  onEnter: () => void;
  /** Small corner label, e.g. "Watched"/"Favorite" on Library tiles — omit for the plain catalog look. */
  badge?: string;
}

export function PosterTile({ id, meta, onEnter, badge }: PosterTileProps) {
  return (
    <FocusableItem id={id} className="poster-tile" onEnter={onEnter}>
      {meta.poster ? (
        <img className="poster-tile__image" src={meta.poster} alt="" loading="lazy" />
      ) : (
        <div className="poster-tile__fallback">{meta.name}</div>
      )}
      {badge && <span className="poster-tile__badge">{badge}</span>}
      <span className="poster-tile__label">{meta.name}</span>
    </FocusableItem>
  );
}
