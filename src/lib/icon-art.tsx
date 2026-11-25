// The app mark: four paint chips from the board, in a 2 x 2 grid.
const CHIPS = ["#e8603c", "#d9a521", "#14a08f", "#7b5cd6"];

export function IconArt({ size, padding, background }: { size: number; padding: number; background?: string }) {
  const gap = Math.max(2, Math.round(size / 14));
  const chip = (size - padding * 2 - gap) / 2;
  const radius = Math.max(2, Math.round(chip / 5));
  return (
    <div
      style={{
        width: size,
        height: size,
        display: "flex",
        flexWrap: "wrap",
        gap,
        padding,
        background: background ?? "transparent",
      }}
    >
      {CHIPS.map((c) => (
        <div key={c} style={{ width: chip, height: chip, borderRadius: radius, background: c }} />
      ))}
    </div>
  );
}
