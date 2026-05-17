// Centered loading spinner using Tailwind animate-spin
export default function LoadingSpinner({ size = "md", text = "" }) {
  const sizeClass = { sm: "h-5 w-5", md: "h-8 w-8", lg: "h-12 w-12" }[size] || "h-8 w-8";

  return (
    <div className="flex flex-col items-center justify-center gap-2 py-8">
      <div
        className={`${sizeClass} animate-spin rounded-full border-4 border-indigo-200 border-t-indigo-600`}
      />
      {text && <p className="text-sm text-gray-500">{text}</p>}
    </div>
  );
}
