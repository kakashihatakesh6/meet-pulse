import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../hooks/useTheme';
import { Button } from './Button';
import { ALARM_PRESETS, formatAlarmOffsetLabel } from '../constants/alarms';

export interface AlarmSelectorProps {
  visible: boolean;
  meetingTitle: string;
  initialOffsets: number[];
  onSave: (selectedOffsets: number[]) => void;
  onClose: () => void;
}

export const AlarmSelector: React.FC<AlarmSelectorProps> = ({
  visible,
  meetingTitle,
  initialOffsets,
  onSave,
  onClose,
}) => {
  const { colors, isDark } = useTheme();
  const [selectedOffsets, setSelectedOffsets] = useState<number[]>(initialOffsets);
  const [customInput, setCustomInput] = useState('');
  const [customError, setCustomError] = useState('');

  // Keep state synced with props when opened
  React.useEffect(() => {
    setSelectedOffsets(initialOffsets);
    setCustomInput('');
    setCustomError('');
  }, [initialOffsets, visible]);

  const togglePreset = (minutes: number) => {
    if (selectedOffsets.includes(minutes)) {
      setSelectedOffsets(selectedOffsets.filter((m) => m !== minutes));
    } else {
      setSelectedOffsets([...selectedOffsets, minutes].sort((a, b) => a - b));
    }
  };

  const handleAddCustom = () => {
    setCustomError('');
    const val = parseInt(customInput.trim(), 10);
    if (isNaN(val) || val < 0 || val > 1440) {
      setCustomError('Enter minutes between 0 and 1440');
      return;
    }
    if (selectedOffsets.includes(val)) {
      setCustomError('Alarm offset already added');
      return;
    }
    setSelectedOffsets([...selectedOffsets, val].sort((a, b) => a - b));
    setCustomInput('');
  };

  const handleRemoveOffset = (minutes: number) => {
    setSelectedOffsets(selectedOffsets.filter((m) => m !== minutes));
  };

  const handleSave = () => {
    onSave(selectedOffsets);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <View
          style={[
            styles.modalContainer,
            {
              backgroundColor: colors.surface,
              borderColor: colors.surfaceBorder,
            },
          ]}
        >
          {/* Header */}
          <View style={styles.header}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.title, { color: colors.text }]}>
                Configure Alarms
              </Text>
              <Text
                style={[styles.meetingSubtitle, { color: colors.textMuted }]}
                numberOfLines={1}
              >
                {meetingTitle}
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={22} color={colors.textMuted} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
            {/* Active Selected Alarms Chips */}
            <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>
              ACTIVE ALARMS ({selectedOffsets.length})
            </Text>
            <View style={styles.chipRow}>
              {selectedOffsets.length === 0 ? (
                <Text style={[styles.emptyAlarmsText, { color: colors.textSubtle }]}>
                  No alarms configured. Select from presets below.
                </Text>
              ) : (
                selectedOffsets.map((offset) => (
                  <View
                    key={offset}
                    style={[
                      styles.selectedChip,
                      {
                        backgroundColor: colors.primaryLight,
                        borderColor: colors.primary,
                      },
                    ]}
                  >
                    <Ionicons
                      name="notifications"
                      size={12}
                      color={colors.primary}
                      style={{ marginRight: 4 }}
                    />
                    <Text
                      style={[styles.selectedChipText, { color: colors.primary }]}
                    >
                      {formatAlarmOffsetLabel(offset)}
                    </Text>
                    <TouchableOpacity
                      onPress={() => handleRemoveOffset(offset)}
                      style={{ marginLeft: 6 }}
                    >
                      <Ionicons
                        name="close-circle"
                        size={14}
                        color={colors.primary}
                      />
                    </TouchableOpacity>
                  </View>
                ))
              )}
            </View>

            {/* Quick Presets Grid */}
            <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>
              PRESET REMINDERS
            </Text>
            <View style={styles.presetsGrid}>
              {ALARM_PRESETS.map((preset) => {
                const isSelected = selectedOffsets.includes(preset.minutes);
                return (
                  <TouchableOpacity
                    key={preset.minutes}
                    activeOpacity={0.7}
                    onPress={() => togglePreset(preset.minutes)}
                    style={[
                      styles.presetCard,
                      {
                        backgroundColor: isSelected
                          ? colors.primaryLight
                          : colors.surfaceSubtle,
                        borderColor: isSelected
                          ? colors.primary
                          : colors.surfaceBorder,
                      },
                    ]}
                  >
                    <Ionicons
                      name={
                        isSelected ? 'checkmark-circle' : 'ellipse-outline'
                      }
                      size={18}
                      color={isSelected ? colors.primary : colors.textMuted}
                      style={{ marginRight: 8 }}
                    />
                    <View style={{ flex: 1 }}>
                      <Text
                        style={[
                          styles.presetLabel,
                          {
                            color: isSelected ? colors.primary : colors.text,
                            fontWeight: isSelected ? '700' : '500',
                          },
                        ]}
                      >
                        {preset.label}
                      </Text>
                      <Text
                        style={[
                          styles.presetDesc,
                          { color: colors.textMuted },
                        ]}
                      >
                        {preset.description}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Custom Minutes Input */}
            <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>
              CUSTOM REMINDER
            </Text>
            <View style={styles.customRow}>
              <TextInput
                value={customInput}
                onChangeText={setCustomInput}
                placeholder="Minutes before (e.g. 45)"
                placeholderTextColor={colors.textSubtle}
                keyboardType="numeric"
                style={[
                  styles.customInput,
                  {
                    backgroundColor: colors.surfaceSubtle,
                    color: colors.text,
                    borderColor: customError
                      ? colors.danger
                      : colors.surfaceBorder,
                  },
                ]}
              />
              <Button
                title="Add"
                onPress={handleAddCustom}
                variant="secondary"
                size="sm"
                style={{ marginLeft: 8 }}
              />
            </View>
            {customError ? (
              <Text style={[styles.errorText, { color: colors.danger }]}>
                {customError}
              </Text>
            ) : null}
          </ScrollView>

          {/* Footer Actions */}
          <View
            style={[
              styles.footer,
              { borderTopColor: colors.surfaceBorder },
            ]}
          >
            <Button
              title="Cancel"
              onPress={onClose}
              variant="ghost"
              size="md"
              style={{ flex: 1, marginRight: 8 }}
            />
            <Button
              title={`Save (${selectedOffsets.length}) Alarms`}
              onPress={handleSave}
              variant="primary"
              size="md"
              style={{ flex: 1.5 }}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    maxHeight: '85%',
    paddingTop: 18,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 14,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
  },
  meetingSubtitle: {
    fontSize: 13,
    marginTop: 2,
  },
  closeBtn: {
    padding: 6,
  },
  content: {
    paddingHorizontal: 20,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginTop: 14,
    marginBottom: 8,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    minHeight: 34,
  },
  emptyAlarmsText: {
    fontSize: 13,
    fontStyle: 'italic',
  },
  selectedChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
  },
  selectedChipText: {
    fontSize: 12,
    fontWeight: '600',
  },
  presetsGrid: {
    gap: 8,
  },
  presetCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  presetLabel: {
    fontSize: 14,
  },
  presetDesc: {
    fontSize: 11,
    marginTop: 1,
  },
  customRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    marginBottom: 6,
  },
  customInput: {
    flex: 1,
    height: 40,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    fontSize: 14,
  },
  errorText: {
    fontSize: 12,
    marginBottom: 8,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderTopWidth: 1,
    marginTop: 12,
  },
});
