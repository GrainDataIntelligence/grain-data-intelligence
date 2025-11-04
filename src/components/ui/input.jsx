export function Input({ className = "", ...props }) {
  return (
    <input
      className={`w-full rounded-lg border border-gray-600 bg-transparent px-3 py-2 text-sm text-gray-100 focus:outline-none focus:ring-2 focus:ring-emerald-500 ${className}`}
      {...props}
    />
  )
}
