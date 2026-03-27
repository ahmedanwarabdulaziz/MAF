import Link from "next/link";

export default function PublicHomePage() {
  return (
    <div className="mx-auto max-w-7xl px-8 py-24 text-center">
      <h1 className="mb-6 text-5xl font-extrabold text-navy">
        نبني المستقبل بجودة وثقة
      </h1>
      <p className="mx-auto mb-10 max-w-2xl text-xl text-text-secondary">
        هذا هو الموقع العام للشركة، يتم من خلاله عرض خدماتنا وأعمالنا السابقة للعملاء والجمهور. 
        لا يتم عرض أي تفاصيل داخلية عن المشاريع هنا.
      </p>
      <div className="flex justify-center gap-4">
        <Link href="/company" className="rounded-md bg-navy px-8 py-3 text-lg font-semibold text-white shadow-sm transition-all hover:bg-opacity-90">
          دخول الموظفين للنظام
        </Link>
        <Link href="#" className="rounded-md border border-border bg-background px-8 py-3 text-lg font-semibold text-navy shadow-sm transition-all hover:bg-background-secondary">
          تواصل معنا
        </Link>
      </div>
    </div>
  )
}
