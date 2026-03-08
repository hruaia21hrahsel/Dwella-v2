import { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Platform, TouchableOpacity } from 'react-native';
import { Text, TextInput, Button, ActivityIndicator, IconButton } from 'react-native-paper';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import DateTimePicker from '@react-native-community/datetimepicker';
import { supabase } from '@/lib/supabase';
import { useTheme } from '@/lib/theme-context';
import { useToastStore } from '@/lib/toast';
import { EXPENSE_CATEGORIES } from '@/lib/expenses';
import { ExpenseCategory } from '@/lib/types';
import { ConfirmDialog } from '@/components/ConfirmDialog';

export default function EditExpenseScreen() {
  const { id: propertyId, expenseId } = useLocalSearchParams<{ id: string; expenseId: string }>();
  const router = useRouter();
  const { colors } = useTheme();

  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState<ExpenseCategory | null>(null);
  const [description, setDescription] = useState('');
  const [expenseDate, setExpenseDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      if (!expenseId) return;
      const { data, error } = await supabase
        .from('expenses')
        .select('*')
        .eq('id', expenseId)
        .single();

      if (error || !data) {
        useToastStore.getState().showToast('Could not load expense.', 'error');
        router.back();
        return;
      }

      setAmount(String(data.amount));
      setCategory(data.category as ExpenseCategory);
      setDescription(data.description ?? '');
      setExpenseDate(new Date(data.expense_date));
      setLoading(false);
    }
    load();
  }, [expenseId]);

  async function handleSave() {
    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      useToastStore.getState().showToast('Please enter a valid amount greater than 0.', 'error');
      return;
    }
    if (!category) {
      useToastStore.getState().showToast('Please select a category.', 'error');
      return;
    }

    setSaving(true);
    const { error } = await supabase
      .from('expenses')
      .update({
        amount: parsedAmount,
        category,
        description: description.trim() || null,
        expense_date: expenseDate.toISOString().split('T')[0],
      })
      .eq('id', expenseId);

    if (error) {
      useToastStore.getState().showToast(error.message, 'error');
    } else {
      router.back();
    }
    setSaving(false);
  }

  async function handleDelete() {
    setDeleting(true);
    const { error } = await supabase.from('expenses').delete().eq('id', expenseId);
    if (error) {
      useToastStore.getState().showToast(error.message, 'error');
      setDeleting(false);
    } else {
      setShowDeleteConfirm(false);
      router.back();
    }
  }

  const dateLabel = expenseDate.toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  if (loading) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'Edit Expense',
          headerTitleAlign: 'center',
          headerStyle: { backgroundColor: colors.surface, height: 64 } as any,
          headerTintColor: colors.textPrimary,
          headerLeft: () => (
            <IconButton icon="close" size={22} onPress={() => router.back()} />
          ),
        }}
      />
      <ScrollView style={[styles.container, { backgroundColor: colors.background }]} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {/* Amount */}
        <Text variant="labelMedium" style={[styles.fieldLabel, { color: colors.textSecondary }]}>Amount</Text>
        <TextInput
          mode="outlined"
          keyboardType="decimal-pad"
          placeholder="0.00"
          value={amount}
          onChangeText={setAmount}
          left={<TextInput.Affix text="₹" />}
          outlineColor={colors.border}
          activeOutlineColor={colors.primary}
        />

        {/* Category */}
        <Text variant="labelMedium" style={[styles.fieldLabel, styles.fieldLabelSpaced, { color: colors.textSecondary }]}>Category</Text>
        <View style={styles.categoryGrid}>
          {EXPENSE_CATEGORIES.map((cat) => {
            const selected = category === cat.value;
            return (
              <TouchableOpacity
                key={cat.value}
                style={[
                  styles.categoryChip,
                  { borderColor: colors.border, backgroundColor: colors.surface },
                  selected && { backgroundColor: cat.color + '22', borderColor: cat.color },
                ]}
                onPress={() => setCategory(cat.value)}
                activeOpacity={0.7}
              >
                <Text
                  variant="labelMedium"
                  style={[{ color: colors.textSecondary }, selected && { color: cat.color }]}
                >
                  {cat.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Date */}
        <Text variant="labelMedium" style={[styles.fieldLabel, styles.fieldLabelSpaced, { color: colors.textSecondary }]}>Date</Text>
        <TouchableOpacity
          style={[styles.datePicker, { backgroundColor: colors.surface, borderColor: colors.border }]}
          onPress={() => setShowDatePicker(true)}
          activeOpacity={0.7}
        >
          <Text variant="bodyMedium" style={{ color: colors.textPrimary, fontWeight: '500' }}>{dateLabel}</Text>
          <Text variant="bodySmall" style={{ color: colors.textSecondary }}>Tap to change</Text>
        </TouchableOpacity>

        {showDatePicker && (
          <DateTimePicker
            value={expenseDate}
            mode="date"
            maximumDate={new Date()}
            onChange={(_event, date) => {
              setShowDatePicker(Platform.OS === 'ios');
              if (date) setExpenseDate(date);
            }}
          />
        )}

        {/* Description */}
        <Text variant="labelMedium" style={[styles.fieldLabel, styles.fieldLabelSpaced, { color: colors.textSecondary }]}>
          Description <Text style={{ color: colors.textDisabled, textTransform: 'none' }}>(optional)</Text>
        </Text>
        <TextInput
          mode="outlined"
          placeholder="e.g. Plumber fixed kitchen sink"
          value={description}
          onChangeText={setDescription}
          multiline
          numberOfLines={3}
          outlineColor={colors.border}
          activeOutlineColor={colors.primary}
        />

        <Button
          mode="contained"
          onPress={handleSave}
          disabled={saving || deleting}
          style={styles.saveButton}
          buttonColor={colors.primary}
        >
          {saving ? <ActivityIndicator size="small" color={colors.textOnPrimary} /> : 'Save Changes'}
        </Button>

        <Button
          mode="outlined"
          onPress={() => setShowDeleteConfirm(true)}
          disabled={saving || deleting}
          style={[styles.deleteButton, { borderColor: colors.error }]}
          textColor={colors.error}
        >
          Delete Expense
        </Button>
      </ScrollView>

      <ConfirmDialog
        visible={showDeleteConfirm}
        title="Delete Expense"
        message="This expense will be permanently removed. This cannot be undone."
        confirmLabel="Delete"
        confirmColor={colors.error}
        loading={deleting}
        onConfirm={handleDelete}
        onCancel={() => setShowDeleteConfirm(false)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { padding: 16, gap: 8, paddingBottom: 40 },
  fieldLabel: { textTransform: 'uppercase', letterSpacing: 0.5 },
  fieldLabelSpaced: { marginTop: 16 },
  categoryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  categoryChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  datePicker: {
    borderRadius: 8,
    borderWidth: 1,
    padding: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  saveButton: { marginTop: 24, borderRadius: 8 },
  deleteButton: { marginTop: 10, borderRadius: 8 },
});
