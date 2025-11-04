export function Label({ children, className = "", ...props }) {
  return (
    <label className={`text-sm font-medium text-gray-200 ${className}`} {...props}>
      {children}
    </label>
  )
}
