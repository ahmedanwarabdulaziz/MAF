import Link from "next/link";

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex h-20 items-center justify-between border-b border-border bg-background px-8 shadow-sm">
        <div className="flex items-center gap-8">
          <div className="text-2xl font-bold tracking-tight text-navy">الشركة للتطوير والمقاولات</div>
          <nav className="hidden gap-6 md:flex">
            <Link href="/" className="font-medium text-text-secondary transition-colors hover:text-primary">الرئيسية</Link>
            <Link href="#" className="font-medium text-text-secondary transition-colors hover:text-primary">من نحن</Link>
            <Link href="#" className="font-medium text-text-secondary transition-colors hover:text-primary">خدماتنا</Link>
            <Link href="#" className="font-medium text-text-secondary transition-colors hover:text-primary">سابقة الأعمال</Link>
            <Link href="#" className="font-medium text-text-secondary transition-colors hover:text-primary">تواصل معنا</Link>
          </nav>
        </div>
        <div>
          <Link href="/company" className="rounded-md bg-primary px-6 py-2.5 font-semibold text-white shadow-sm transition-all hover:bg-opacity-90">
            الدخول إلى النظام
          </Link>
        </div>
      </header>
      <main className="flex-1 bg-background-secondary">{children}</main>
      <footer className="mt-auto border-t border-border bg-background py-8 text-center text-sm text-text-secondary">
        جميع الحقوق محفوظة &copy; {new Date().getFullYear()} - شركة التطوير والمقاولات
      </footer>
    </div>
  )
}
