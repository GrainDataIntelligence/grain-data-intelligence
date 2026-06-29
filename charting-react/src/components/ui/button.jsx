export function Button({ children, className = "", ...props }) {
  return (
    <button
      className={`px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-medium transition ${className}`}
      {...props}
    >
      {children}
    </button>
  )
}
