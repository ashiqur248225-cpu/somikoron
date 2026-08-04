
"use client"

export default function StudentLayout({ children }: { children: React.ReactNode }) {
  // Navigation is now handled by the root LayoutWrapper for consistent performance
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {children}
    </div>
  )
}
