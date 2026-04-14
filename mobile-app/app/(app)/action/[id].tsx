import { View, Text, StyleSheet, Alert, TouchableOpacity, ActivityIndicator, ScrollView, Image, TextInput } from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { useState } from 'react'
import * as ImagePicker from 'expo-image-picker'
import * as DocumentPicker from 'expo-document-picker'
import { useActionDetails, useExecuteAction } from '../../../src/hooks/useActionDetails'
import { supabase } from '../../../src/lib/supabase'
import { useLocation } from '../../../src/hooks/useLocation'
import { captureMobileEvent } from '../../../src/lib/api'
import * as Device from 'expo-device'

export default function ActionDetailScreen() {
  const { id } = useLocalSearchParams()
  const stringId = Array.isArray(id) ? id[0] : id

  const { data, isLoading, isError } = useActionDetails(stringId)
  const { mutate: executeAction, isPending } = useExecuteAction()
  const { getDeviceLocation, isRequestingLocation } = useLocation()

  // Camera Attachment State
  const [attachments, setAttachments] = useState<{ uri: string, name: string, type: string }[]>([])
  const [isUploading, setIsUploading] = useState(false)
  const [note, setNote] = useState('')

  const handleAddPhoto = async () => {
    const permissionResult = await ImagePicker.requestCameraPermissionsAsync()
    if (permissionResult.granted === false) {
      Alert.alert('الصلاحيات مطلوبة', 'عذراً لا يمكننا استخدام الكاميرا بدون صلاحية.')
      return
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.5, // Compress for bandwidth
    })

    if (!result.canceled && result.assets && result.assets.length > 0) {
      const asset = result.assets[0]
      const fileExt = asset.uri.split('.').pop() || 'jpg'
      setAttachments(prev => [...prev, {
        uri: asset.uri,
        name: `photo_${Date.now()}.${fileExt}`,
        type: `image/${fileExt}`
      }])
    }
  }

  const handlePickGallery = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.5,
    })

    if (!result.canceled && result.assets && result.assets.length > 0) {
      const asset = result.assets[0]
      const fileExt = asset.uri.split('.').pop() || 'jpg'
      setAttachments(prev => [...prev, {
        uri: asset.uri,
        name: `gallery_${Date.now()}.${fileExt}`,
        type: `image/${fileExt}`
      }])
    }
  }

  const handlePickDocument = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: ['application/pdf'],
      copyToCacheDirectory: true
    })

    if (!result.canceled && result.assets && result.assets.length > 0) {
      const asset = result.assets[0]
      setAttachments(prev => [...prev, {
        uri: asset.uri,
        name: asset.name || `doc_${Date.now()}.pdf`,
        type: asset.mimeType || 'application/pdf'
      }])
    }
  }

  const uploadAttachmentsAndExecute = async (actionType: 'approve' | 'reject') => {
    try {
      setIsUploading(true)
      const uploadedUrls: string[] = []

      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token
      
      if (!token) throw new Error('تسجيل الدخول مطلوب')

      // Capture GPS metrics gracefully (non-blocking) before proceeding
      const location = await getDeviceLocation()
      
      await captureMobileEvent({
        action_type: actionType === 'approve' ? 'approve_action' : 'reject_action',
        entity_type: data?.data?.type,
        entity_id: stringId,
        location,
        device_context: {
          os: Device.osName,
          osVersion: Device.osVersion,
          model: Device.modelName,
        }
      })

      // Upload one by one directly to Next.js API
      for (const file of attachments) {
        const formData = new FormData()
        formData.append('file', {
          uri: file.uri,
          name: file.name,
          type: file.type || 'image/jpeg'
        } as any)

        const baseUrl = process.env.EXPO_PUBLIC_API_BASE_URL
        const uploadResponse = await fetch(`${baseUrl}/api/mobile/upload`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}` },
          body: formData
        })

        if (!uploadResponse.ok) {
          throw new Error('فشل رفع أحد المرفقات، يرجى المحاولة مرة أخرى')
        }

        const uploadData = await uploadResponse.json()
        if (uploadData.url) uploadedUrls.push(uploadData.url)
      }

      // Execute approval
      executeAction({ id: stringId, action: actionType, attachmentUrls: uploadedUrls, note }, {
        onSuccess: () => {
          setIsUploading(false)
          Alert.alert('نجاح', 'تم تنفيذ الإجراء بنجاح', [
            { text: 'حسناً', onPress: () => router.back() }
          ])
        },
        onError: (err) => {
          setIsUploading(false)
          Alert.alert('خطأ', err.message)
        }
      })
    } catch (error: any) {
      setIsUploading(false)
      Alert.alert('خطأ', error.message)
    }
  }

  const handleQuickAction = (actionType: 'approve' | 'reject') => {
    const actionTranslation = actionType === 'approve' ? 'اعتماد' : 'رفض'
    Alert.alert(`تأكيد ال${actionTranslation}`, `هل أنت متأكد من رغبتك في ${actionTranslation} هذا المستند بصورته المرفقة؟`, [
      { text: 'إلغاء', style: 'cancel' },
      {
        text: actionTranslation,
        style: actionType === 'approve' ? 'default' : 'destructive',
        onPress: () => uploadAttachmentsAndExecute(actionType)
      }
    ])
  }

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#0070f3" />
      </View>
    )
  }

  if (isError || !data?.data) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>تعذر جلب التفاصيل.</Text>
        <TouchableOpacity style={styles.buttonSecondary} onPress={() => router.back()}>
          <Text style={styles.buttonTextSecondary}>العودة</Text>
        </TouchableOpacity>
      </View>
    )
  }

  const { type, header, lines, message } = data.data
  const isBusy = isPending || isUploading || isRequestingLocation
  const isPendingAction = header?.status === 'pending_approval' || header?.status === 'draft' || header?.status === 'submitted'

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>
          {type === 'purchase_request' ? `طلب شراء: ${header?.request_no}` :
            type === 'supplier_invoice' ? `فاتورة مورد: ${header?.invoice_no}` :
              type === 'store_issue' ? `إذن صرف: ${header?.document_no}` :
                type === 'subcontractor_certificate' ? `مستخلص رقم: ${header?.certificate_no}` :
                  type === 'owner_billing' ? `فاتورة مالك رقم: ${header?.document_no}` :
                    type === 'petty_expense' ? `مصروف نثري: ${header?.id?.substring(0, 8)}` :
                      type === 'retention_release' ? `استرداد تعلية` : 'مستند غير معروف'}
        </Text>

        {header?.project && (
          <Text style={styles.projectText}>📍 {header.project.arabic_name}</Text>
        )}

        <View style={styles.card}>
          {message ? (
            <Text style={styles.bodyText}>{message}</Text>
          ) : (
            <>
              <Text style={styles.bodyText}>تاريخ الإنشاء: {new Date(header.created_at).toLocaleDateString('ar-EG')}</Text>
              {header.notes && <Text style={styles.bodyText}>ملاحظات: {header.notes}</Text>}

              <View style={styles.divider} />
              <Text style={styles.sectionTitle}>البنود ({lines?.length || 0}):</Text>
              {lines?.map((l: any, i: number) => (
                <View key={i} style={styles.lineRow}>
                  <Text style={styles.lineItemName}>🔸 {l.item?.arabic_name || 'صنف غير معروف'}</Text>
                  <Text style={styles.lineItemQty}>الكمية: {l.requested_quantity || l.invoiced_quantity || l.quantity_issued || 0}</Text>
                </View>
              ))}
            </>
          )}
        </View>

        {/* Attachments Section */}
        {!message && isPendingAction && (
          <View style={styles.attachmentSection}>
            <Text style={styles.sectionTitle}>إرفاق مستندات الاعتماد (اختياري)</Text>
            <View style={styles.attachmentButtonsRow}>
              <TouchableOpacity style={styles.cameraBtnSmall} onPress={handleAddPhoto}>
                <Text style={styles.cameraBtnText}>📸 الكاميرا</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.cameraBtnSmall} onPress={handlePickGallery}>
                <Text style={styles.cameraBtnText}>🖼️ المعرض</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.cameraBtnSmall} onPress={handlePickDocument}>
                <Text style={styles.cameraBtnText}>📄 ملف PDF</Text>
              </TouchableOpacity>
            </View>

            {attachments.length > 0 && (
              <View style={styles.photoGrid}>
                {attachments.map((file, idx) => (
                  <View key={idx} style={styles.previewContainer}>
                    {file.type.includes('pdf') ? (
                       <View style={[styles.previewImage, { justifyContent: 'center', alignItems: 'center', backgroundColor: '#e2e8f0' }]}>
                          <Text style={{ fontSize: 24 }}>📄</Text>
                       </View>
                    ) : (
                       <Image source={{ uri: file.uri }} style={styles.previewImage} />
                    )}
                    <TouchableOpacity style={styles.removeBtn} onPress={() => setAttachments(prev => prev.filter((_, i) => i !== idx))}>
                      <Text style={styles.removeText}>X</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}
          </View>
        )}

        {/* Note input */}
        {!message && isPendingAction && (
          <View style={styles.noteSection}>
            <Text style={styles.sectionTitle}>إضافة ملاحظة</Text>
            <TextInput
              style={styles.noteInput}
              multiline
              placeholder="اكتب ملاحظة للطلب..."
              value={note}
              onChangeText={setNote}
            />
          </View>
        )}

      </ScrollView>

      {/* Quick Actions Footer */}
      {!message && isPendingAction && (
        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.actionBtn, styles.rejectBtn, isBusy && styles.disabledBtn]}
            onPress={() => handleQuickAction('reject')}
            disabled={isBusy}
          >
            <Text style={styles.rejectBtnText}>رفض</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionBtn, styles.approveBtn, isBusy && styles.disabledBtn]}
            onPress={() => handleQuickAction('approve')}
            disabled={isBusy}
          >
            {isBusy ? <ActivityIndicator color="#fff" /> : <Text style={styles.approveBtnText}>{attachments.length > 0 ? 'رفع المرفقات واعتماد' : 'اعتماد الإجراء'}</Text>}
          </TouchableOpacity>
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
    direction: 'rtl',
  },
  scroll: {
    padding: 24,
    paddingBottom: 40,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  errorText: {
    fontSize: 16,
    color: '#ef4444',
    marginBottom: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#0f172a',
    marginBottom: 4,
  },
  projectText: {
    fontSize: 14,
    color: '#475569',
    marginBottom: 20,
    fontWeight: '600',
  },
  card: {
    backgroundColor: '#ffffff',
    padding: 16,
    borderRadius: 8,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  bodyText: {
    fontSize: 14,
    color: '#334155',
    marginBottom: 8,
    lineHeight: 22,
  },
  divider: {
    height: 1,
    backgroundColor: '#e2e8f0',
    marginVertical: 12,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#0f172a',
    marginBottom: 8,
  },
  lineRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  lineItemName: {
    fontSize: 13,
    color: '#334155',
    flex: 1,
  },
  lineItemQty: {
    fontSize: 13,
    color: '#64748b',
    fontWeight: '600',
  },
  attachmentSection: {
    marginTop: 8,
  },
  attachmentButtonsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  cameraBtn: {
    backgroundColor: '#e2e8f0',
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 16,
  },
  cameraBtnSmall: {
    flex: 1,
    backgroundColor: '#e2e8f0',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  cameraBtnText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#0f172a',
  },
  photoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  previewContainer: {
    position: 'relative',
    width: 80,
    height: 80,
  },
  previewImage: {
    width: '100%',
    height: '100%',
    borderRadius: 8,
    backgroundColor: '#cbd5e1',
  },
  removeBtn: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: '#ef4444',
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 12,
  },
  noteSection: {
    marginTop: 16,
  },
  noteInput: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    padding: 12,
    minHeight: 80,
    textAlignVertical: 'top',
    fontSize: 14,
    color: '#0f172a',
  },
  footer: {
    flexDirection: 'row',
    padding: 16,
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    gap: 12,
  },
  actionBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabledBtn: {
    opacity: 0.6,
  },
  rejectBtn: {
    backgroundColor: '#fee2e2',
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  rejectBtnText: {
    color: '#ef4444',
    fontWeight: 'bold',
    fontSize: 15,
  },
  approveBtn: {
    backgroundColor: '#0070f3',
  },
  approveBtnText: {
    color: '#ffffff',
    fontWeight: 'bold',
    fontSize: 15,
  },
  buttonSecondary: {
    backgroundColor: '#e2e8f0',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  buttonTextSecondary: {
    color: '#0f172a',
    fontWeight: 'bold',
  },
})
