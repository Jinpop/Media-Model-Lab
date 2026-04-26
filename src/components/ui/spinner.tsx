export function Spinner() {
  return (
    <div
      aria-label="로딩 중"
      className="h-4 w-4 animate-spin rounded-full border-2 border-zinc-400 border-t-cyan-400"
      role="status"
    />
  );
}
