import * as React from "react"

export function Card({ className = "", children, ...props }) {
  return (
    <div className={`rounded-2xl border bg-white/5 shadow-sm ${className}`} {...props}>
      {children}
    </div>
  )
}

export function CardHeader({ className = "", children }) {
  return <div className={`border-b px-4 py-2 ${className}`}>{children}</div>
}

export function CardTitle({ className = "", children }) {
  return <h2 className={`font-semibold text-lg ${className}`}>{children}</h2>
}

export function CardContent({ className = "", children }) {
  return <div className={`p-4 ${className}`}>{children}</div>
}
