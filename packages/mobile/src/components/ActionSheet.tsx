import { Modal, View, Text, TouchableOpacity, StyleSheet, Pressable } from 'react-native'
import { useI18n } from '@smart-files/shared/src/i18n'

export type ActionItem = {
  key: string
  label: string
  icon?: string
  danger?: boolean
  onPress: () => void
}

function ActionSheet({
  visible,
  title,
  actions,
  onClose,
}: {
  visible: boolean
  title?: string
  actions: ActionItem[]
  onClose: () => void
}) {
  const { t } = useI18n()
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={() => {}}>
          {title ? (
            <View style={styles.header}>
              <Text style={styles.title} numberOfLines={1}>{title}</Text>
            </View>
          ) : null}

          {actions.map((action, i) => (
            <TouchableOpacity
              key={action.key}
              style={[
                styles.actionBtn,
                i > 0 && styles.actionBtnBorder,
                i === 0 && !title && styles.actionBtnFirst,
              ]}
              onPress={() => {
                onClose()
                // Small delay to let close animation start before firing action
                setTimeout(() => action.onPress(), 100)
              }}
              activeOpacity={0.6}
            >
              <View style={styles.actionContent}>
                {action.icon ? (
                  <Text style={styles.actionIcon}>{action.icon}</Text>
                ) : null}
                <Text
                  style={[
                    styles.actionLabel,
                    action.danger && styles.actionLabelDanger,
                  ]}
                >
                  {action.label}
                </Text>
              </View>
            </TouchableOpacity>
          ))}

          <TouchableOpacity
            style={[styles.cancelBtn, styles.actionBtnBorder]}
            onPress={onClose}
            activeOpacity={0.6}
          >
            <Text style={styles.cancelLabel}>{t.cancel}</Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  )
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#f2f2f7',
    borderTopLeftRadius: 14,
    borderTopRightRadius: 14,
    paddingBottom: 34,
    paddingHorizontal: 8,
    paddingTop: 8,
  },
  header: {
    paddingVertical: 12,
    paddingHorizontal: 12,
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#d1d1d6',
    marginBottom: 8,
  },
  title: {
    fontSize: 13,
    color: '#8e8e93',
    fontWeight: '500',
  },
  actionBtn: {
    backgroundColor: '#fff',
    paddingVertical: 14,
  },
  actionBtnBorder: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#d1d1d6',
  },
  actionBtnFirst: {
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
  },
  actionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionIcon: {
    fontSize: 18,
    marginRight: 8,
  },
  actionLabel: {
    fontSize: 17,
    color: '#007AFF',
    fontWeight: '400',
    textAlign: 'center',
  },
  actionLabelDanger: {
    color: '#FF3B30',
  },
  cancelBtn: {
    backgroundColor: '#fff',
    borderRadius: 12,
    marginTop: 8,
    paddingVertical: 14,
    alignItems: 'center',
  },
  cancelLabel: {
    fontSize: 17,
    color: '#007AFF',
    fontWeight: '600',
  },
})

export default ActionSheet
