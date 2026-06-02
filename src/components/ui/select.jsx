import { useState } from "react"

export function Select({ value, onValueChange, children, className = "" }) {
  return (
    <select
      value={value}
      onChange={(e) => onValueChange && onValueChange(e.target.value)}
      className={`w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-400 ${className}`}
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
