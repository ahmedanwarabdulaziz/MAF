import Link from "next/link";

export default function PublicHomePage() {
  return (
    <div className="flex h-[80vh] items-center justify-center px-8">
      <Link 
        href="/company" 
        className="rounded-xl bg-navy px-12 py-5 text-2xl font-bold text-white shadow-xl shadow-navy/20 transition-all hover:scale-105 hover:bg-navy/90 hover:shadow-2xl"
      >
        الدخول إلى النظام
      </Link>
    </div>
  )
}
