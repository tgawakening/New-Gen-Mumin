type HouseDisplayProps = {
  name: string;
  color?: string | null;
  virtue?: string | null;
  points?: number;
  rank?: number;
  isMine?: boolean;
  dark?: boolean;
};

function houseInitial(name: string) {
  return name.trim().charAt(0).toUpperCase() || "H";
}

export function HouseBadge({ name, color, virtue, dark = false }: HouseDisplayProps) {
  const swatch = color ?? "#245d85";
  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full border px-3 py-2 text-sm font-semibold ${
        dark ? "border-white/20 bg-white/10 text-white" : "border-[#e3d8c9] bg-white text-[#22304a]"
      }`}
    >
      <span className="h-4 w-4 rounded-full border border-black/10 shadow-sm" style={{ backgroundColor: swatch }} />
      <span>{name}</span>
      {virtue ? <span className={dark ? "text-white/65" : "text-[#617184]"}>{virtue}</span> : null}
    </span>
  );
}

export function HouseLeaderboardRow({ name, color, virtue, points = 0, rank = 1, isMine = false, dark = false }: HouseDisplayProps) {
  const swatch = color ?? "#245d85";
  const maxWidth = Math.min(100, Math.max(10, points));
  return (
    <div
      className={`overflow-hidden rounded-2xl border shadow-sm ${
        dark ? "border-white/10 bg-white/10 text-white" : isMine ? "border-[#22304a] bg-white text-[#22304a]" : "border-[#eadfce] bg-[#fbf6ef] text-[#22304a]"
      }`}
    >
      <div className="h-1.5" style={{ backgroundColor: swatch }} />
      <div className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl text-sm font-bold text-white shadow-sm" style={{ backgroundColor: swatch }}>
            {rank ? `#${rank}` : houseInitial(name)}
          </span>
          <div className="min-w-0">
            <p className="truncate font-semibold">{name}{isMine ? " - your house" : ""}</p>
            {virtue ? <p className={`text-xs ${dark ? "text-white/65" : "text-[#617184]"}`}>{virtue}</p> : null}
          </div>
        </div>
        <span className={`shrink-0 rounded-full px-3 py-1 font-semibold ${dark ? "bg-white text-[#22304a]" : "bg-[#22304a] text-white"}`}>
          {points} pts
        </span>
      </div>
      <div className={dark ? "h-2 bg-white/10" : "h-2 bg-[#ece3d5]"}>
        <div className="h-full rounded-r-full" style={{ width: `${maxWidth}%`, backgroundColor: swatch }} />
      </div>
    </div>
  );
}
