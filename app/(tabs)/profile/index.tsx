import { useState } from 'react';
import { View, StyleSheet, ScrollView, Alert } from 'react-native';
import { Text, TextInput, Button, Avatar, Divider } from 'react-native-paper';
import { useAuthStore } from '@/lib/store';
import { supabase } from '@/lib/supabase';
import { Colors } from '@/constants/colors';

export default function ProfileScreen() {
  const { user, setUser } = useAuthStore();
  const [fullName, setFullName] = useState(user?.full_name ?? '');
  const [phone, setPhone] = useState(user?.phone ?? '');
  const [saving, setSaving] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  async function handleSave() {
    if (!user) return;
    setSaving(true);

    const { data, error } = await supabase
      .from('users')
      .update({ full_name: fullName, phone: phone || null })
      .eq('id', user.id)
      .select()
      .single();

    if (error) {
      Alert.alert('Error', error.message);
    } else if (data) {
      setUser(data);
      Alert.alert('Saved', 'Profile updated successfully.');
    }

    setSaving(false);
  }

  async function handleLogout() {
    setLoggingOut(true);
    await supabase.auth.signOut();
    setLoggingOut(false);
  }

  const initials = user?.full_name
    ? user.full_name.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase()
    : user?.email?.[0]?.toUpperCase() ?? '?';

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Avatar */}
      <View style={styles.avatarRow}>
        <Avatar.Text size={72} label={initials} style={styles.avatar} />
        <Text variant="titleLarge" style={styles.name}>{user?.full_name ?? 'User'}</Text>
        <Text variant="bodyMedium" style={styles.email}>{user?.email}</Text>
      </View>

      <Divider style={styles.divider} />

      {/* Edit Form */}
      <Text variant="titleSmall" style={styles.sectionTitle}>Edit Profile</Text>

      <TextInput
        label="Full Name"
        value={fullName}
        onChangeText={setFullName}
        mode="outlined"
        style={styles.input}
      />

      <TextInput
        label="Phone"
        value={phone}
        onChangeText={setPhone}
        keyboardType="phone-pad"
        mode="outlined"
        style={styles.input}
      />

      <TextInput
        label="Email"
        value={user?.email ?? ''}
        mode="outlined"
        style={styles.input}
        disabled
      />

      <Button
        mode="contained"
        onPress={handleSave}
        loading={saving}
        disabled={saving}
        style={styles.saveButton}
      >
        Save Changes
      </Button>

      <Divider style={styles.divider} />

      <Button
        mode="outlined"
        onPress={handleLogout}
        loading={loggingOut}
        disabled={loggingOut}
        textColor={Colors.error}
        style={styles.logoutButton}
      >
        Sign Out
      </Button>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    padding: 24,
    gap: 12,
  },
  avatarRow: {
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  avatar: {
    backgroundColor: Colors.primary,
  },
  name: {
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  email: {
    color: Colors.textSecondary,
  },
  divider: {
    marginVertical: 8,
  },
  sectionTitle: {
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  input: {
    backgroundColor: Colors.surface,
  },
  saveButton: {
    marginTop: 8,
  },
  logoutButton: {
    borderColor: Colors.error,
    marginTop: 8,
  },
});
