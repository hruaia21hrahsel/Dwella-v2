import { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, KeyboardAvoidingView, Platform, TouchableOpacity } from 'react-native';
import { TextInput, Button, HelperText, Text, IconButton } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/lib/store';
import { useTheme } from '@/lib/theme-context';
import { useToastStore } from '@/lib/toast';
import { Property } from '@/lib/types';

const PROPERTY_COLORS = [
  { value: '#009688', label: 'Teal' },
  { value: '#4F46E5', label: 'Indigo' },
  { value: '#2563EB', label: 'Blue' },
  { value: '#7C3AED', label: 'Purple' },
  { value: '#DB2777', label: 'Pink' },
  { value: '#DC2626', label: 'Red' },
  { value: '#EA580C', label: 'Orange' },
  { value: '#D97706', label: 'Amber' },
  { value: '#16A34A', label: 'Green' },
  { value: '#0D9488', label: 'Cyan' },
  { value: '#475569', label: 'Slate' },
  { value: '#78716C', label: 'Stone' },
];

export default function PropertyCreateScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const router = useRouter();
  const { user, bumpPropertyRefresh } = useAuthStore();
  const { colors, shadows } = useTheme();
  const isEditing = !!id;

  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [totalUnits, setTotalUnits] = useState('1');
  const [notes, setNotes] = useState('');
  const [color, setColor] = useState<string>(PROPERTY_COLORS[0].value);
  const [loading, setLoading] = useState(false);
  const [fetchingProperty, setFetchingProperty] = useState(isEditing);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!isEditing) return;

    async function fetchProperty() {
      const { data } = await supabase
        .from('properties')
        .select('*')
        .eq('id', id)
        .single<Property>();

      if (data) {
        setName(data.name);
        setAddress(data.address);
        setCity(data.city);
        setTotalUnits(String(data.total_units));
        setNotes(data.notes ?? '');
        setColor(data.color ?? PROPERTY_COLORS[0].value);
      }
      setFetchingProperty(false);
    }

    fetchProperty();
  }, [id, isEditing]);

  function validate(): boolean {
    const errs: Record<string, string> = {};
    if (!name.trim()) errs.name = 'Property name is required.';
    if (!address.trim()) errs.address = 'Address is required.';
    if (!city.trim()) errs.city = 'City is required.';
    const units = parseInt(totalUnits, 10);
    if (isNaN(units) || units < 1) errs.totalUnits = 'Must be at least 1.';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function handleSubmit() {
    if (!validate()) return;
    if (!user) {
      useToastStore.getState().showToast('Session expired. Please log out and log back in.', 'error');
      return;
    }
    setLoading(true);

    const payload = {
      name: name.trim(),
      address: address.trim(),
      city: city.trim(),
      total_units: parseInt(totalUnits, 10),
      notes: notes.trim() || null,
      color,
    };

    if (isEditing) {
      const { error } = await supabase
        .from('properties')
        .update(payload)
        .eq('id', id);

      if (error) {
        useToastStore.getState().showToast(error.message, 'error');
      } else {
        bumpPropertyRefresh();
        router.back();
      }
    } else {
      const { data: created, error } = await supabase
        .from('properties')
        .insert({ ...payload, owner_id: user.id })
        .select()
        .single();

      if (error) {
        useToastStore.getState().showToast(error.message, 'error');
      } else if (!created) {
        useToastStore.getState().showToast('Property was not saved. Check your connection and try again.', 'error');
      } else {
        bumpPropertyRefresh();
        router.dismiss();
      }
    }

    setLoading(false);
  }

  if (fetchingProperty) {
    return <View style={[styles.container, { backgroundColor: colors.background }]} />;
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: isEditing ? 'Edit Property' : 'New Property',
          headerTitleAlign: 'center',
          headerStyle: { backgroundColor: colors.surface, height: 64 } as any,
          headerTintColor: colors.textPrimary,
          headerLeft: () => (
            <IconButton icon="close" size={22} onPress={() => router.back()} />
          ),
        }}
      />
      <KeyboardAvoidingView
        style={[styles.container, { backgroundColor: colors.background }]}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {/* Property Details */}
          <View style={[styles.sectionCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.sectionHeader}>
              <MaterialCommunityIcons name="office-building-outline" size={18} color={colors.primary} />
              <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Property Details</Text>
            </View>
            <TextInput
              label="Property Name"
              value={name}
              onChangeText={setName}
              mode="outlined"
              style={[styles.input, { backgroundColor: colors.surface }]}
              outlineStyle={styles.inputOutline}
              error={!!errors.name}
            />
            {errors.name && <HelperText type="error">{errors.name}</HelperText>}

            <TextInput
              label="Total Units"
              value={totalUnits}
              onChangeText={setTotalUnits}
              keyboardType="number-pad"
              mode="outlined"
              style={[styles.input, { backgroundColor: colors.surface }]}
              outlineStyle={styles.inputOutline}
              error={!!errors.totalUnits}
            />
            {errors.totalUnits && <HelperText type="error">{errors.totalUnits}</HelperText>}
          </View>

          {/* Color Picker */}
          <View style={[styles.sectionCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.sectionHeader}>
              <MaterialCommunityIcons name="palette-outline" size={18} color={colors.primary} />
              <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Property Color</Text>
            </View>
            <Text style={[styles.colorHint, { color: colors.textSecondary }]}>Choose a color to identify this property</Text>
            <View style={styles.colorGrid}>
              {PROPERTY_COLORS.map((c) => {
                const selected = c.value === color;
                return (
                  <TouchableOpacity
                    key={c.value}
                    style={[
                      styles.colorSwatch,
                      { backgroundColor: c.value },
                      selected && [styles.colorSwatchSelected, { borderColor: colors.textOnPrimary }],
                    ]}
                    onPress={() => setColor(c.value)}
                    activeOpacity={0.7}
                  >
                    {selected && (
                      <MaterialCommunityIcons name="check" size={18} color={colors.textOnPrimary} />
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
            {/* Preview */}
            <View style={[styles.colorPreview, { backgroundColor: color + '15', borderColor: color + '40' }]}>
              <View style={[styles.colorPreviewDot, { backgroundColor: color }]} />
              <Text style={[styles.colorPreviewText, { color }]}>
                {name.trim() || 'Property Name'}
              </Text>
            </View>
          </View>

          {/* Location */}
          <View style={[styles.sectionCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.sectionHeader}>
              <MaterialCommunityIcons name="map-marker-outline" size={18} color={colors.primary} />
              <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Location</Text>
            </View>
            <TextInput
              label="Address"
              value={address}
              onChangeText={setAddress}
              mode="outlined"
              style={[styles.input, { backgroundColor: colors.surface }]}
              outlineStyle={styles.inputOutline}
              multiline
              numberOfLines={2}
              error={!!errors.address}
            />
            {errors.address && <HelperText type="error">{errors.address}</HelperText>}

            <TextInput
              label="City"
              value={city}
              onChangeText={setCity}
              mode="outlined"
              style={[styles.input, { backgroundColor: colors.surface }]}
              outlineStyle={styles.inputOutline}
              error={!!errors.city}
            />
            {errors.city && <HelperText type="error">{errors.city}</HelperText>}
          </View>

          {/* Additional Info */}
          <View style={[styles.sectionCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.sectionHeader}>
              <MaterialCommunityIcons name="note-text-outline" size={18} color={colors.primary} />
              <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Additional Info</Text>
            </View>
            <TextInput
              label="Notes (optional)"
              value={notes}
              onChangeText={setNotes}
              mode="outlined"
              style={[styles.input, { backgroundColor: colors.surface }]}
              outlineStyle={styles.inputOutline}
              multiline
              numberOfLines={3}
            />
          </View>

          <Button
            mode="contained"
            onPress={handleSubmit}
            loading={loading}
            disabled={loading}
            style={[styles.submitBtn, shadows.sm]}
            contentStyle={styles.submitBtnContent}
          >
            {isEditing ? 'Save Changes' : 'Create Property'}
          </Button>
        </ScrollView>
      </KeyboardAvoidingView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 16,
    gap: 16,
    paddingBottom: 40,
  },
  sectionCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 16,
    gap: 12,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  input: {
  },
  inputOutline: {
    borderRadius: 12,
  },

  // Color picker
  colorHint: {
    fontSize: 12,
    marginTop: -4,
  },
  colorGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  colorSwatch: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  colorSwatchSelected: {
    borderWidth: 3,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 6,
    elevation: 4,
  },
  colorPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  colorPreviewDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  colorPreviewText: {
    fontSize: 14,
    fontWeight: '600',
  },

  submitBtn: {
    marginTop: 4,
    borderRadius: 14,
  },
  submitBtnContent: {
    paddingVertical: 10,
  },
});
