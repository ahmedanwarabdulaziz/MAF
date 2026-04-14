import { useState, useMemo } from 'react'
import { StyleSheet, View, Text, FlatList, ActivityIndicator, TouchableOpacity, RefreshControl } from 'react-native'
import { useCriticalActions } from '../../src/hooks/useCriticalActions'
import CriticalActionCard from '../../src/components/CriticalActionCard'
import { WorkInboxPriority } from '../../src/types/work-inbox'
import { supabase } from '../../src/lib/supabase'

export default function CriticalActionsScreen() {
  const { data, isLoading, isError, error, refetch, isFetching, dataUpdatedAt } = useCriticalActions()
  const [filterPriority, setFilterPriority] = useState<WorkInboxPriority | 'all'>('all')

  const items = data?.data?.items || []
  const filteredItems = useMemo(() => {
    let result = items
    if (filterPriority !== 'all') {
      result = items.filter((item: WorkInboxItem) => item.priority === filterPriority)
    }
    // Deduplicate to prevent FlatList duplicate key warnings if the API accidentally returns duplicates
    return result.filter((item: WorkInboxItem, index: number, self: WorkInboxItem[]) =>
      index === self.findIndex((t) => t.id === item.id)
    )
  }, [items, filterPriority])

  const lastSynced = dataUpdatedAt ? new Date(dataUpdatedAt).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }) : null

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>مهامي الحرجة</Text>
          {lastSynced && (
            <Text style={styles.subtitle}>
              آخر تحديث: {lastSynced} {isFetching && '(جاري التحديث...)'}
            </Text>
          )}
        </View>
        <TouchableOpacity style={styles.logoutButton} onPress={() => supabase.auth.signOut()}>
          <Text style={styles.logoutText}>خروج</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.filterRow}>
        <TouchableOpacity style={[styles.filterChip, filterPriority === 'all' && styles.filterChipActive]} onPress={() => setFilterPriority('all')}>
          <Text style={[styles.filterText, filterPriority === 'all' && styles.filterTextActive]}>الكل ({items.length})</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.filterChip, filterPriority === 'critical' && styles.filterChipActive]} onPress={() => setFilterPriority('critical')}>
          <Text style={[styles.filterText, filterPriority === 'critical' && styles.filterTextActive]}>🔴 حرج</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.filterChip, filterPriority === 'high' && styles.filterChipActive]} onPress={() => setFilterPriority('high')}>
          <Text style={[styles.filterText, filterPriority === 'high' && styles.filterTextActive]}>🟡 مرتفع</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.filterChip, filterPriority === 'normal' && styles.filterChipActive]} onPress={() => setFilterPriority('normal')}>
          <Text style={[styles.filterText, filterPriority === 'normal' && styles.filterTextActive]}>🟢 عادي</Text>
        </TouchableOpacity>
      </View>

      {isLoading && !items.length ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#0070f3" />
        </View>
      ) : isError && !items.length ? (
        <View style={styles.centered}>
          <Text style={styles.errorText}>حدث خطأ أثناء تحميل البيانات</Text>
          <Text style={styles.errorSub}>{error?.message}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={() => refetch()}>
            <Text style={styles.retryText}>إعادة المحاولة</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={filteredItems}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <CriticalActionCard item={item} />}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={isFetching && !isLoading} onRefresh={refetch} tintColor="#0070f3" />
          }
          ListEmptyComponent={
            <View style={styles.centeredPage}>
              <Text style={styles.emptyIcon}>✅</Text>
              <Text style={styles.emptyTitle}>لا توجد مهام مطابقة</Text>
              <Text style={styles.emptySub}>أنت على اطلاع بكل المهام</Text>
            </View>
          }
        />
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
  header: {
    paddingX: 16,
    paddingTop: 16,
    paddingHorizontal: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 16,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#0f172a',
  },
  subtitle: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 4,
  },
  logoutButton: {
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  logoutText: {
    color: '#ef4444',
    fontSize: 12,
    fontWeight: 'bold',
  },
  filterRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#f1f5f9',
  },
  filterChipActive: {
    backgroundColor: '#0f172a',
  },
  filterText: {
    fontSize: 13,
    color: '#475569',
    fontWeight: '600',
  },
  filterTextActive: {
    color: '#ffffff',
  },
  listContent: {
    padding: 16,
    paddingBottom: 40,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  centeredPage: {
    paddingTop: 60,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#ef4444',
    marginBottom: 8,
  },
  errorSub: {
    fontSize: 13,
    color: '#64748b',
    marginBottom: 16,
    textAlign: 'center',
  },
  retryButton: {
    backgroundColor: '#0f172a',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryText: {
    color: '#ffffff',
    fontWeight: 'bold',
  },
  emptyIcon: {
    fontSize: 40,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#0f172a',
    marginBottom: 8,
  },
  emptySub: {
    fontSize: 14,
    color: '#64748b',
  },
})
