import { FocusableItem } from "@/components/FocusableItem";
import "./HomeScreen.css";

// Placeholder rails only — real catalog aggregation from installed add-ons
// lands in Milestone 2 (see docs/PROJECT_PLAN.md sections 16-17). This
// screen's job right now is proving the shell, focus ring, and spatial nav
// work across a realistic grid layout before any network code exists.
const PLACEHOLDER_ROWS = [
  { title: "Continue Watching", count: 6 },
  { title: "Recommended", count: 8 },
  { title: "Your Add-ons", count: 4 },
];

export function HomeScreen() {
  return (
    <div className="home-screen">
      {PLACEHOLDER_ROWS.map((row) => (
        <section key={row.title} className="home-row">
          <h2 className="home-row__title">{row.title}</h2>
          <div className="home-row__items">
            {Array.from({ length: row.count }).map((_, i) => (
              <FocusableItem key={i} id={`${row.title}-${i}`} className="home-tile">
                <span className="text-dim">{i + 1}</span>
              </FocusableItem>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
