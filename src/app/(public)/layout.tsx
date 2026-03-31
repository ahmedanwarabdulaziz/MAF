import Link from "next/link";

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex min-h-screen flex-col">

      <main className="flex-1 bg-background-secondary">{children}</main>

    </div>
  )
}
