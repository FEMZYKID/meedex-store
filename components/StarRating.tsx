// Shows a rating as stars, with partial fill (e.g. 4.3 out of 5)
export default function StarRating({ rating, size = 14 }: { rating: number; size?: number }) {
    const pct = Math.max(0, Math.min(100, (rating / 5) * 100));
    return (
      <span
        className="relative inline-block leading-none align-middle"
        style={{ fontSize: size }}
        role="img"
        aria-label={`${rating.toFixed(1)} out of 5 stars`}
      >
        <span className="text-gray-300" aria-hidden="true">★★★★★</span>
        <span
          className="absolute left-0 top-0 overflow-hidden whitespace-nowrap text-amber-500"
          style={{ width: `${pct}%` }}
          aria-hidden="true"
        >
          ★★★★★
        </span>
      </span>
    );
  }