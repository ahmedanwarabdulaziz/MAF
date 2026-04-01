export const metadata = { title: 'الاعتمادات والملاحظات الهامة | الشركة' }

export default async function CriticalActionsPage() {
  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6" dir="rtl">
      <div>
        <h1 className="text-2xl font-bold text-navy">الاعتمادات والملاحظات الهامة</h1>
        <p className="text-sm text-text-secondary mt-1">توضح هذه الشاشة البيانات الحرجة التي تتطلب مراجعة أو اعتماد أو تضم ملاحظات هامة.</p>
      </div>

      <div className="bg-white rounded-xl border border-border shadow-sm p-12 flex flex-col items-center justify-center text-center">
        <div className="w-16 h-16 bg-background-secondary rounded-full flex items-center justify-center mb-4">
          <span className="text-2xl">⚡</span>
        </div>
        <h3 className="text-lg font-bold text-navy mb-2">جاري التجهيز...</h3>
        <p className="text-sm text-text-secondary max-w-md">
          هذه الصفحة مخصصة لعرض البطاقات الهامة التي تحتاج لاعتماد أو قراءة ملاحظات العمل. سيتم إضافة العناصر هنا خطوة بخطوة كما طلبت.
        </p>
      </div>
    </div>
  )
}
