'use client';

import { useState } from 'react';
import { deleteItem } from '@/actions/warehouse';

export default function DeleteItemButton({ itemId, itemName }: { itemId: string; itemName: string }) {
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    if (!confirm(`هل أنت متأكد من مسح الصنف "${itemName}"؟`)) {
      return;
    }
    setIsDeleting(true);
    try {
      await deleteItem(itemId);
      // Wait a moment for UI to respond, but it should auto-refresh due to revalidatePath
    } catch (error: any) {
      alert(error.message || 'حدث خطأ أثناء محاولة المسح');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <button
      onClick={handleDelete}
      disabled={isDeleting}
      title="مسح"
      className="inline-flex items-center justify-center h-8 w-8 rounded-lg border border-border text-text-secondary hover:border-danger hover:text-danger hover:bg-danger/5 transition-colors disabled:opacity-50"
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
