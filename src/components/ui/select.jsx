import { useState } from "react"

export function Select({ value, onValueChange, children, className = "" }) {
  return (
    <select
      value={value}
      onChange={(e) => onValueChange && onValueChange(e.target.value)}
      className={`w-full rounded-lg border border-gray-600 bg-zinc-800 px-3 py-2 text-sm text-gray-50 focus:outline-none focus:ring-2 focus:ring-emerald-500 ${className}`}
    >
      {children}
    </select>
  )
}

export function SelectTrigger({ children }) {
  return <>{children}</>
}
export function SelectValue({ children }) {
  return <>{children}</>
}
export function SelectContent({ children }) {
  return <>{children}</>
}
export function SelectItem({ value, children }) {
  return <option value={value}>{children}</option>
}
