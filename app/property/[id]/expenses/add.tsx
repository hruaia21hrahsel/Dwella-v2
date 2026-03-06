import { useState } from 'react';
import { View, StyleSheet, ScrollView, Alert, Platform } from 'react-native';
import { Text, TextInput, Button, ActivityIndicator, IconButton } from 'react-native-paper';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import DateTimePicker from '@react-native-community/datetimepicker';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/lib/store';
import { Colors } from '@/constants/colors';
import { EXPENSE_CATEGORIES } from '@/lib/expenses';
import { ExpenseCategory } from '@/lib/types';
import { TouchableOpacity } from 'react-native';

export default function AddExpenseScreen() {
  const { id: propertyId } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuthStore();

  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState<ExpenseCategory | null>(null);
  const [description, setDescription] = useState('');
  const [expenseDate, setExpenseDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!user || !propertyId) return;

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
    const { error } = await supabase.from('expenses').insert({
      property_id: propertyId,
      user_id: user.id,
      amount: parsedAmount,
      category,
      description: description.trim() || null,
      expense_date: expenseDate.toISOString().split('T')[0],
    });

    if (error) {
      Alert.alert('Error', error.message);
    } else {
      router.back();
    }
    setSaving(false);
  }

  const dateLabel = expenseDate.toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'Add Expense',
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
          disabled={saving}
          style={styles.saveButton}
          buttonColor={Colors.primary}
        >
          {saving ? <ActivityIndicator size="small" color="#fff" /> : 'Save Expense'}
        </Button>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
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
});
