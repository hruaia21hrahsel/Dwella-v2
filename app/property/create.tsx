import { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { TextInput, Button, HelperText, IconButton } from 'react-native-paper';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/lib/store';
import { Colors } from '@/constants/colors';
import { useToastStore } from '@/lib/toast';
import { Property } from '@/lib/types';

export default function PropertyCreateScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const router = useRouter();
  const { user, bumpPropertyRefresh } = useAuthStore();
  const isEditing = !!id;

  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [totalUnits, setTotalUnits] = useState('1');
  const [notes, setNotes] = useState('');
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
    return <View style={styles.container} />;
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: isEditing ? 'Edit Property' : 'New Property',
          headerLeft: () => (
            <IconButton icon="close" size={22} onPress={() => router.back()} />
          ),
        }}
      />
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <TextInput
            label="Property Name"
            value={name}
            onChangeText={setName}
            mode="outlined"
            style={styles.input}
            error={!!errors.name}
          />
          {errors.name && <HelperText type="error">{errors.name}</HelperText>}

          <TextInput
            label="Address"
            value={address}
            onChangeText={setAddress}
            mode="outlined"
            style={styles.input}
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
            style={styles.input}
            error={!!errors.city}
          />
          {errors.city && <HelperText type="error">{errors.city}</HelperText>}

          <TextInput
            label="Total Units"
            value={totalUnits}
            onChangeText={setTotalUnits}
            keyboardType="number-pad"
            mode="outlined"
            style={styles.input}
            error={!!errors.totalUnits}
          />
          {errors.totalUnits && <HelperText type="error">{errors.totalUnits}</HelperText>}

          <TextInput
            label="Notes (optional)"
            value={notes}
            onChangeText={setNotes}
            mode="outlined"
            style={styles.input}
            multiline
            numberOfLines={3}
          />

          <Button
            mode="contained"
            onPress={handleSubmit}
            loading={loading}
            disabled={loading}
            style={styles.button}
            contentStyle={styles.buttonContent}
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
    backgroundColor: Colors.background,
  },
  content: {
    padding: 16,
    gap: 4,
  },
  input: {
    backgroundColor: Colors.surface,
  },
  button: {
    marginTop: 16,
  },
  buttonContent: {
    paddingVertical: 6,
  },
});
