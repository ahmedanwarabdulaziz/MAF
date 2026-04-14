import { StyleSheet, View, Text, TouchableOpacity } from 'react-native'
import { WorkInboxItem, TYPE_LABELS } from '../types/work-inbox'
import { router } from 'expo-router'

type Props = {
  item: WorkInboxItem
}

export default function CriticalActionCard({ item }: Props) {
  
  // Choose accent color based on priority
  let accentColor = '#22c55e' // normal - green
  if (item.priority === 'critical') accentColor = '#ef4444' // red
  else if (item.priority === 'high') accentColor = '#eab308' // amber

  return (
    <TouchableOpacity 
      style={[styles.card, { borderRightColor: accentColor }]}
      onPress={() => router.push(`/(app)/action/${item.id}`)}
      activeOpacity={0.7}
    >
      <View style={styles.headerRow}>
        <View style={[styles.badge, { backgroundColor: accentColor + '20' }]}>
          <Text style={[styles.badgeText, { color: accentColor }]}>
            {item.ageDays ? `منذ ${item.ageDays} يوم` : 'جديد'}
          </Text>
        </View>
        <Text style={styles.typeLabel}>{TYPE_LABELS[item.type] || item.type}</Text>
      </View>

      <Text style={styles.title} numberOfLines={2}>
        {item.title}
      </Text>

      {item.projectName && (
        <Text style={styles.project} numberOfLines={1}>
          📍 {item.projectName}
        </Text>
      )}

      {(item.amount !== null && item.amount !== undefined) && (
        <Text style={styles.amount}>
          💰 {item.amount.toLocaleString()} {item.currency}
        </Text>
      )}

      <View style={styles.footerRow}>
        <Text style={styles.statusLabel}>{item.statusLabel}</Text>
        <Text style={styles.actionLabel}>{item.actionLabel} &rarr;</Text>
      </View>
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
    borderRightWidth: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
    direction: 'rtl',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  typeLabel: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: 'bold',
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: 'bold',
  },
  title: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#0f172a',
    marginBottom: 8,
  },
  project: {
    fontSize: 13,
    color: '#475569',
    marginBottom: 6,
  },
  amount: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0f172a',
    marginBottom: 8,
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  statusLabel: {
    fontSize: 12,
    color: '#64748b',
  },
  actionLabel: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#0070f3',
  },
})
