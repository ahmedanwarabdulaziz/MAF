# تبسيط منظومة الصلاحيات والاعتمادات

## ملخص المشكلة

النظام الحالي يحتوي على منظومة صلاحيات قوية تقنياً لكنها معقدة من ناحية تجربة المستخدم:

1. **تناقض في تسمية الأفعال (action_keys)** — توجد مجموعتان مختلفتان:
   - **Migration 003** (DB seed): `view, create, edit, approve, export, reject, lock, delete_or_archive, return_for_correction`
   - **Seed API route**: `view, manage, review, operate, warehouse, execute, enter, export, upload`
   - النتيجة: نفس الصلاحية قد تظهر بأسماء مختلفة حسب المصدر
   
2. **ثلاث صفحات إعدادات منفصلة** للمفهوم الواحد:
   - إدارة المستخدمين (`/users`) ← فيها اختيار permission groups بدون scope
   - مجموعات الصلاحيات (`/permission-groups`) ← matrix تقنية
   - نطاق الوصول (`/access-scopes`) ← User + Role Template + Scope (الأكثر فائدة)

3. **لا يوجد صندوق موحد للاعتمادات** — كل module تعالج اعتماداتها بشكل مستقل (store issues, invoices, certificates)

4. **الـ RLS policies قديمة جزئياً** — بعضها يستخدم `user_access_scopes` والبعض الآخر يستخدم `user_permission_group_assignments`

---

## تحليل الوضع الحالي

### هيكل الجداول

| الجدول | الدور | الحالة |
|--------|------|--------|
| `permissions` | registry لكل module_key × action_key + Arabic labels | ✅ موجود — يحتاج توحيد |
| `permission_groups` | Role Templates (قوالب وظيفية) | ✅ يعمل |
| `permission_group_permissions` | Matrix: أي قالب تحتوي أي صلاحية | ✅ يعمل |
| `user_permission_group_assignments` | الجدول الرئيسي: User + Template + Scope | ✅ يعمل (consolidated in migration 028) |
| `user_access_scopes` | **قديم** — تم استبداله بدمج Scope في assignments | ⚠️ فارغ ولكن بعض RLS لا يزال يقرأ منه |
| `user_role_assignments` | **غير مستخدم** — roles table مرجعية فقط | ⚠️ يمكن إزالته مستقبلاً |
| `roles` | أسماء أدوار مرجعية | ℹ️ معلوماتي فقط |
| `approval_delegations` | تفويض اعتمادات | ℹ️ موجود لكن غير مفعل في UI |
| `store_issue_approvals` | Dual-approval audit log for store issues | ✅ يعمل |

### الصفحات المتأثرة

| الصفحة | ما يظهر فيها | المشكلة |
|--------|------------|---------|
| `/company/settings/users/[id]` | Permission Groups بدون scope | يعيّن groups بدون تحديد scope — **confusing** |
| `/company/settings/permission-groups/[id]` | Matrix: module × action | يعرض action_keys تقنية ("operate", "warehouse") |
| `/company/settings/access-scopes` | User + Template + Scope | ✅ **الأفضل** — لكن يحتاج تحسين |

---

## User Review Required

> [!IMPORTANT]
> **القرار الأهم: تبسيط صفحة المستخدم**
> 
> صفحة تعديل المستخدم (`EditUserForm`) حالياً تسمح باختيار permission groups **بدون scope**. هذا يسبب ارتباك لأن نفس الشيء يتم في صفحة access-scopes **مع scope**.
> 
> **اقتراحي**: إزالة قسم "مجموعات الصلاحيات" من صفحة تعديل المستخدم نهائياً، والاعتماد فقط على صفحة "فريق العمل والصلاحيات" (`access-scopes`) التي تجمع الثلاثة: User + Role Template + Scope.

> [!WARNING]
> **توحيد action_keys** سيتطلب migration لتحديث الـ `permissions` table والـ `permission_group_permissions` table. 
> هل تريد أن نحتفظ بالمفاتيح القديمة كـ aliases أم نحذفها مباشرة؟

> [!IMPORTANT]
> **صفحة مجموعات الصلاحيات** (`permission-groups/[id]`) — هل تريد إبقاءها كأداة admin-only للمتقدمين، أم تريد إخفاءها من القائمة وتبسيط الشاشة؟

---

## Proposed Changes

### Phase 1: توحيد قاموس الأفعال (Canonical Action Vocabulary)

هدف: تعريف قاموس واحد فقط لكل الأفعال، مع Arabic labels واضحة.

#### القاموس الجديد المقترح

| action_key | Arabic Label | المعنى | يحل محل |
|-----------|-------------|--------|---------|
| `view` | عرض | مشاهدة البيانات | — (كما هو) |
| `create` | إنشاء | إنشاء سجل جديد | `enter`, `upload` |
| `edit` | تعديل | تعديل سجل موجود | `operate` |
| `approve` | اعتماد | الموافقة النهائية | `review` |
| `execute` | تنفيذ | تنفيذ عملية مالية/مخزنية | `warehouse`, `execute` |
| `export` | تصدير | تصدير بيانات | — (كما هو) |
| `delete` | حذف | حذف أو أرشفة | `delete_or_archive` |
| `manage` | إدارة كاملة | كل الصلاحيات | — (كما هو) |

---

#### [MODIFY] [route.ts](file:///d:/Res/MAF/src/app/api/seed-permissions/route.ts)
- توحيد الـ `PERMISSIONS` array ليستخدم القاموس الجديد فقط
- إزالة `operate`, `warehouse`, `review`, `enter`, `upload` واستبدالها بالمقابلات من القاموس الجديد
- تحديث `action_name_ar` لتكون **مسميات وظيفية واضحة** بدلاً من مسميات تقنية

**مثال التحويل:**

```diff
-  { module_key: 'supplier_procurement', action_key: 'operate', action_name_ar: 'إنشاء وتسجيل' },
-  { module_key: 'supplier_procurement', action_key: 'warehouse', action_name_ar: 'تأكيد استلام المخزن' },
-  { module_key: 'supplier_procurement', action_key: 'review', action_name_ar: 'مراجعة واعتماد' },
+  { module_key: 'supplier_procurement', action_key: 'create', action_name_ar: 'إنشاء فاتورة مورد' },
+  { module_key: 'supplier_procurement', action_key: 'execute', action_name_ar: 'تأكيد استلام المخزن' },
+  { module_key: 'supplier_procurement', action_key: 'approve', action_name_ar: 'اعتماد فاتورة مورد' },
```

---

### Phase 2: قاموس المسميات العربية (Arabic Label Dictionary)

هدف: إنشاء ملف مركزي يحتوي على كل الترجمات — يُستخدم في UI بدلاً من عرض action_keys مباشرة.

#### [NEW] [permission-labels.ts](file:///d:/Res/MAF/src/lib/permission-labels.ts)

ملف واحد يصدّر:
- `MODULE_LABELS`: قاموس `module_key → اسم عربي`
- `ACTION_LABELS`: قاموس `action_key → اسم عربي`
- `PERMISSION_DESCRIPTIONS`: قاموس `module_key:action_key → وصف عربي مفصل` (اختياري)
- `MODULE_GROUPS`: تجميع الوحدات حسب المسؤولية (بدلاً من تكراره في EditPermissionGroupForm)

```typescript
// src/lib/permission-labels.ts

export const MODULE_LABELS: Record<string, string> = {
  dashboard: 'لوحة التحكم',
  approvals: 'صندوق الاعتمادات',
  projects: 'المشروعات',
  treasury: 'الخزينة والحسابات البنكية',
  supplier_procurement: 'مشتريات وفواتير الموردين',
  owner_billing: 'مستخلصات المالك',
  subcontractor_certificates: 'مستخلصات المقاولين',
  project_warehouse: 'مخزن المشروع',
  main_warehouse: 'المخزن الرئيسي',
  employee_custody: 'العهد والمصروفات النثرية',
  payments: 'سندات الصرف والمدفوعات',
  // ... etc
}

export const ACTION_LABELS: Record<string, string> = {
  view: 'عرض',
  create: 'إنشاء',
  edit: 'تعديل',
  approve: 'اعتماد',
  execute: 'تنفيذ',
  export: 'تصدير',
  delete: 'حذف',
  manage: 'إدارة كاملة',
}

export const BUSINESS_ROLE_GROUPS = [
  {
    label: 'الوحدات المشتركة',
    modules: ['dashboard', 'approvals', 'attachments', 'projects'],
  },
  {
    label: 'الحوكمة والإدارة',
    modules: ['users_and_access', 'approval_workflows', 'settings', 'cutover'],
  },
  {
    label: 'الشركة الرئيسية',
    modules: ['treasury', 'assets', 'item_master', 'main_warehouse', 'party_masters', 'corporate_expenses', 'consolidated_reports'],
  },
  {
    label: 'الموقع والمشروع',
    modules: ['project_profile', 'subcontractor_certificates', 'supplier_procurement', 'project_warehouse', 'employee_custody', 'owner_billing', 'payments', 'project_documents', 'project_reports'],
  },
]
```

#### [MODIFY] [EditPermissionGroupForm.tsx](file:///d:/Res/MAF/src/app/(system)/company/settings/permission-groups/[id]/EditPermissionGroupForm.tsx)
- استيراد `BUSINESS_ROLE_GROUPS` من `permission-labels.ts` بدلاً من تعريفها محلياً
- عرض `action_name_ar` من الـ DB أو من القاموس المركزي

---

### Phase 3: تبسيط تجربة تعيين المستخدمين

هدف: صفحة واحدة فقط للتعيين بثلاثة حقول: **مستخدم + قالب وظيفي + نطاق**.

#### [MODIFY] [EditUserForm.tsx](file:///d:/Res/MAF/src/app/(system)/company/settings/users/[id]/EditUserForm.tsx)
- **إزالة قسم "مجموعات الصلاحيات"** بالكامل (السطور 121-157)
- إضافة رابط واضح لصفحة access-scopes: "لإدارة صلاحيات هذا المستخدم، اذهب إلى فريق العمل والصلاحيات"
- إبقاء: الاسم، حالة النشاط، Super Admin فقط

#### [MODIFY] [actions.ts (users)](file:///d:/Res/MAF/src/app/(system)/company/settings/users/actions.ts)
- إزالة منطق تعيين permission_groups من `updateUserAction` (سطور 85-108)
- الآن التعيين يتم فقط من `access-scopes`

#### [MODIFY] [SettingsMenu.tsx](file:///d:/Res/MAF/src/app/(system)/SettingsMenu.tsx)
- تغيير label "نطاق الوصول" ← **"تعيين فريق العمل"** (أوضح)
- اختيارياً: إخفاء "مجموعات الصلاحيات" من القائمة العادية وإظهارها فقط لـ super admins

#### [MODIFY] [page.tsx (access-scopes)](file:///d:/Res/MAF/src/app/(system)/company/settings/access-scopes/page.tsx)
- تحديث العنوان الرئيسي ليكون أوضح
- إضافة شرح بسيط للمستخدم: "اختر الموظف → حدد قالبه الوظيفي → حدد نطاق عمله"

---

### Phase 4: صندوق اعتمادات موحد (Unified Approvals Inbox)

هدف: شاشة واحدة تعرض **كل الاعتمادات المعلقة** عبر كل الوحدات.

#### [NEW] [page.tsx (approvals)](file:///d:/Res/MAF/src/app/(system)/company/approvals/page.tsx)
صفحة جديدة `/company/approvals` تعرض:

1. **أذونات صرف معلقة** (store_issues with `status = 'pending_approval'`)
2. **فواتير موردين بانتظار الاعتماد** (supplier_invoices with `status = 'pending'`)
3. **مستخلصات مقاولين بانتظار الاعتماد** (subcontractor_certificates with `status = 'pending_approval'`)
4. **مستخلصات مالك بانتظار الاعتماد** (owner_billing_invoices with `status = 'draft'`)

كل بند يعرض:
- نوع العملية (بالعربي)
- رقم المستند
- المشروع
- المبلغ (إن وجد)
- المنشئ
- تاريخ الإنشاء
- زر اعتماد / رفض

#### [NEW] [actions.ts (approvals)](file:///d:/Res/MAF/src/app/(system)/company/approvals/actions.ts)
Server actions لجلب الاعتمادات المعلقة وتنفيذ الاعتماد/الرفض.

#### [MODIFY] [HeaderNav.tsx](file:///d:/Res/MAF/src/app/(system)/HeaderNav.tsx) أو Sidebar
- إضافة رابط "صندوق الاعتمادات" مع badge يعرض عدد الاعتمادات المعلقة

---

### Phase 5: تعزيز التطبيق الخلفي (Server-Side Enforcement)

هدف: عدم الاعتماد على UI فقط لتطبيق الصلاحيات.

#### [MODIFY] [permissions.ts](file:///d:/Res/MAF/src/lib/permissions.ts)
- إضافة convenience function: `requireApprovalPermission(moduleKey, projectId)` تفحص `approve` action

#### [NEW] [041_fix_approval_permissions.sql](file:///d:/Res/MAF/supabase/migrations/041_fix_approval_permissions.sql)
- تعديل `approve_store_issue` RPC ليتحقق من صلاحيات المستخدم **قبل** تنفيذ الاعتماد:
  ```sql
  -- Check user has the relevant permission
  IF NOT EXISTS (
    SELECT 1 FROM permission_group_permissions pgp
    JOIN user_permission_group_assignments uga ON ...
    WHERE uga.user_id = v_user_id
      AND pgp.module_key = 'project_warehouse'
      AND pgp.action_key = 'approve'
      AND pgp.is_allowed = true
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'ليس لديك صلاحية اعتماد أذونات الصرف');
  END IF;
  ```

#### [NEW] SQL Migration
- إضافة check مماثل في RPCs الأخرى (supplier invoice approval, certificate approval, etc.)

---

### Phase 6: ترحيل المفاتيح القديمة (Migration Strategy)

#### [NEW] [041_unify_permission_keys.sql](file:///d:/Res/MAF/supabase/migrations/041_unify_permission_keys.sql)

```sql
-- 1. Update permissions registry: rename old action_keys
UPDATE permissions SET action_key = 'create' WHERE action_key = 'enter';
UPDATE permissions SET action_key = 'create' WHERE action_key = 'upload' AND module_key = 'attachments';
UPDATE permissions SET action_key = 'edit' WHERE action_key = 'operate';
UPDATE permissions SET action_key = 'approve' WHERE action_key = 'review';
UPDATE permissions SET action_key = 'execute' WHERE action_key = 'warehouse';
UPDATE permissions SET action_key = 'delete' WHERE action_key = 'delete_or_archive';

-- 2. Update permission_group_permissions to match
UPDATE permission_group_permissions SET action_key = 'create' WHERE action_key = 'enter';
-- ... same pattern for each rename

-- 3. Remove duplicates (where old and new key existed simultaneously)
-- Use a CTE to keep only one row per (permission_group_id, module_key, action_key)

-- 4. Update Arabic labels in permissions table
UPDATE permissions SET action_name_ar = 'اعتماد' WHERE action_key = 'approve';
-- ... etc
```

> [!CAUTION]
> هذا الـ migration يجب أن يتم **قبل** تشغيل الكود الجديد. يُفضل تنفيذه في وقت صيانة مخطط.

---

## Open Questions

> [!IMPORTANT]
> 1. **هل نزيل قسم "مجموعات الصلاحيات" من صفحة تعديل المستخدم؟** (اقتراحي: نعم)
> 2. **هل نخفي صفحة مجموعات الصلاحيات من القائمة العادية؟** (اقتراحي: لا — تبقى للمتقدمين)
> 3. **صندوق الاعتمادات — هل يكون على مستوى الشركة فقط (`/company/approvals`) أم على مستوى كل مشروع أيضاً؟** (اقتراحي: كلاهما)
> 4. **هل تريد تنفيذ كل المراحل دفعة واحدة أم على مراحل؟**

---

## Verification Plan

### Automated Tests
1. Run `npm run build` after each phase to validate compilation
2. Test permission checking: create a non-admin user, assign a role template + scope, verify they can/cannot access the expected modules
3. Test the migration SQL on a staging database first

### Manual Verification
1. **Workflow: استلام بضاعة** — Test warehouse receipt with project_warehouse.execute permission
2. **Workflow: اعتماد مدير مشروع** — Test store issue approval with project_warehouse.approve permission
3. **Workflow: مراجعة فاتورة مورد** — Test supplier invoice approval with supplier_procurement.approve
4. **Workflow: اعتماد مستخلص مالك** — Test owner billing approval with owner_billing.approve
5. **Approvals inbox** — Verify all pending items appear in the unified inbox

### Browser Testing
- Navigate the simplified settings pages
- Verify Arabic labels display correctly (RTL)
- Test the grant scope flow: User → Role Template → Scope
