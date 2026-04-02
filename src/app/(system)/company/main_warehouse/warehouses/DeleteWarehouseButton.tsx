'use client';

import { useState } from 'react';
import { deleteWarehouse } from '@/actions/warehouse';

export default function DeleteWarehouseButton({ warehouseId, warehouseName }: { warehouseId: string; warehouseName: string }) {
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    if (!confirm(`هل أنت متأكد من مسح المخزن "${warehouseName}"؟ لا يمكن التراجع.`)) {
      return;
    }
    setIsDeleting(true);
    try {
      await deleteWarehouse(warehouseId);
      // Success triggers revalidatePath
    } catch (error: any) {
      alert(error.message || 'حدث خطأ أثناء محاولة مسح المخزن');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <button
      onClick={handleDelete}
      disabled={isDeleting}
      title="مسح المخزن"
      className="inline-flex items-center justify-center p-2 rounded-lg text-text-secondary hover:text-danger hover:bg-danger/10 disabled:opacity-50 transition-colors"
    >
      {isDeleting ? (
        <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
        </svg>
      ) : (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
        </svg>
      )}
    </button>
  );
}
