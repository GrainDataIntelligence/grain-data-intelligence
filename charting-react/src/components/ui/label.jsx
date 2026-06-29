export function Label({ children, className = "", ...props }) {
  return (
    <label className={`text-sm font-medium text-slate-700 ${className}`} {...props}>
      {children}
    </label>
  )
}
