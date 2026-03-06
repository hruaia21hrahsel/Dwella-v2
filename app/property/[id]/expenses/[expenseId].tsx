import { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Alert, Platform, TouchableOpacity } from 'react-native';
import { Text, TextInput, Button, ActivityIndicator, IconButton } from 'react-native-paper';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import DateTimePicker from '@react-native-community/datetimepicker';
import { supabase } from '@/lib/supabase';
import { Colors } from '@/constants/colors';
import { EXPENSE_CATEGORIES } from '@/lib/expenses';
import { ExpenseCategory } from '@/lib/types';
import { ConfirmDialog } from '@/components/ConfirmDialog';

export default function EditExpenseScreen() {
  const { id: propertyId, expenseId } = useLocalSearchParams<{ id: string; expenseId: string }>();
  const router = useRouter();

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
        Alert.alert('Error', 'Could not load expense.');
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
      Alert.alert('Validation', 'Please enter a valid amount greater than 0.');
      return;
    }
    if (!category) {
      Alert.alert('Validation', 'Please select a category.');
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
      Alert.alert('Error', error.message);
    } else {
      router.back();
    }
    setSaving(false);
  }

  async function handleDelete() {
    setDeleting(true);
    const { error } = await supabase.from('expenses').delete().eq('id', expenseId);
    if (error) {
      Alert.alert('Error', error.message);
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
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Edit Expense',
          headerStyle: { backgroundColor: Colors.surface },
          headerTintColor: Colors.textPrimary,
          headerLeft: () => (
            <IconButton icon="close" size={22} onPress={() => router.back()} />
          ),
        }}
      />
      <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {/* Amount */}
        <Text variant="labelMedium" style={styles.fieldLabel}>Amount</Text>
        <TextInput
          mode="outlined"
          keyboardType="decimal-pad"
          placeholder="0.00"
          value={amount}
          onChangeText={setAmount}
          left={<TextInput.Affix text="₹" />}
          outlineColor={Colors.border}
          activeOutlineColor={Colors.primary}
        />

        {/* Category */}
        <Text variant="labelMedium" style={[styles.fieldLabel, styles.fieldLabelSpaced]}>Category</Text>
        <View style={styles.categoryGrid}>
          {EXPENSE_CATEGORIES.map((cat) => {
            const selected = category === cat.value;
            return (
              <TouchableOpacity
                key={cat.value}
                style={[
                  styles.categoryChip,
                  selected && { backgroundColor: cat.color + '22', borderColor: cat.color },
                ]}
                onPress={() => setCategory(cat.value)}
                activeOpacity={0.7}
              >
                <Text
                  variant="labelMedium"
                  style={[styles.categoryLabel, selected && { color: cat.color }]}
                >
                  {cat.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Date */}
        <Text variant="labelMedium" style={[styles.fieldLabel, styles.fieldLabelSpaced]}>Date</Text>
        <TouchableOpacity
          style={styles.datePicker}
          onPress={() => setShowDatePicker(true)}
          activeOpacity={0.7}
        >
          <Text variant="bodyMedium" style={styles.dateText}>{dateLabel}</Text>
          <Text variant="bodySmall" style={styles.dateHint}>Tap to change</Text>
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
        <Text variant="labelMedium" style={[styles.fieldLabel, styles.fieldLabelSpaced]}>
          Description <Text style={styles.optional}>(optional)</Text>
        </Text>
        <TextInput
          mode="outlined"
          placeholder="e.g. Plumber fixed kitchen sink"
          value={description}
          onChangeText={setDescription}
          multiline
          numberOfLines={3}
          outlineColor={Colors.border}
          activeOutlineColor={Colors.primary}
        />

        <Button
          mode="contained"
          onPress={handleSave}
          disabled={saving || deleting}
          style={styles.saveButton}
          buttonColor={Colors.primary}
        >
          {saving ? <ActivityIndicator size="small" color="#fff" /> : 'Save Changes'}
        </Button>

        <Button
          mode="outlined"
          onPress={() => setShowDeleteConfirm(true)}
          disabled={saving || deleting}
          style={styles.deleteButton}
          textColor={Colors.error}
        >
          Delete Expense
        </Button>
      </ScrollView>

      <ConfirmDialog
        visible={showDeleteConfirm}
        title="Delete Expense"
        message="This expense will be permanently removed. This cannot be undone."
        confirmLabel="Delete"
        confirmColor={Colors.error}
        loading={deleting}
        onConfirm={handleDelete}
        onCancel={() => setShowDeleteConfirm(false)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.background },
  content: { padding: 16, gap: 4, paddingBottom: 40 },
  fieldLabel: { color: Colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5 },
  fieldLabelSpaced: { marginTop: 16 },
  optional: { color: Colors.textDisabled, textTransform: 'none' },
  categoryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  categoryChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  categoryLabel: { color: Colors.textSecondary },
  datePicker: {
    backgroundColor: Colors.surface,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  dateText: { color: Colors.textPrimary, fontWeight: '500' },
  dateHint: { color: Colors.textSecondary },
  saveButton: { marginTop: 24, borderRadius: 8 },
  deleteButton: { marginTop: 10, borderRadius: 8, borderColor: Colors.error },
  error: { color: Colors.error },
});
