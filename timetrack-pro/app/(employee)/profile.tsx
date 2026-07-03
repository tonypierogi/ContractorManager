import { useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Alert,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useForm, Controller } from 'react-hook-form';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import { useAuth } from '@/lib/auth-provider';
import { useUpdateProfile } from '@/hooks/useProfile';
import { formatCurrency } from '@/utils/format';
import { Colors, Spacing, FontSize, FontWeight, BorderRadius } from '@/constants/theme';

interface ProfileForm {
  first_name: string;
  last_name: string;
  phone: string;
  address_street: string;
  address_street2: string;
  address_city: string;
  address_state: string;
  address_zip: string;
}

export default function ProfileScreen() {
  const { profile, user, refreshProfile } = useAuth();
  const updateProfile = useUpdateProfile();
  const { width } = useWindowDimensions();

  const { control, handleSubmit, reset } = useForm<ProfileForm>({
    defaultValues: {
      first_name: '',
      last_name: '',
      phone: '',
      address_street: '',
      address_street2: '',
      address_city: '',
      address_state: '',
      address_zip: '',
    },
  });

  useEffect(() => {
    if (profile) {
      reset({
        first_name: profile.first_name ?? '',
        last_name: profile.last_name ?? '',
        phone: profile.phone ?? '',
        address_street: profile.address_street ?? '',
        address_street2: profile.address_street2 ?? '',
        address_city: profile.address_city ?? '',
        address_state: profile.address_state ?? '',
        address_zip: profile.address_zip ?? '',
      });
    }
  }, [profile, reset]);

  const onSave = async (data: ProfileForm) => {
    if (!user) return;
    try {
      await updateProfile.mutateAsync({ userId: user.id, updates: data });
      await refreshProfile();
      Alert.alert('Success', 'Profile updated');
    } catch {
      Alert.alert('Error', 'Failed to update profile');
    }
  };

  const rateDisplay = profile?.hourly_rate != null
    ? formatCurrency(profile.hourly_rate)
    : '—';

  return (
    <SafeAreaView style={styles.safe} edges={[]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.flex}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.heading}>My Profile</Text>

          <View style={styles.panelsRow}>
            {/* Panel 1 - Personal Information */}
            <View style={[styles.panel, styles.panelForm]}>
              <View style={styles.sectionHeader}>
                <View style={styles.dot} />
                <Text style={styles.sectionTitle}>Personal Information</Text>
              </View>

              <View style={styles.fieldRow}>
                <View style={styles.flex}>
                  <Controller
                    control={control}
                    name="first_name"
                    render={({ field: { onChange, value } }) => (
                      <Input label="First Name" value={value} onChangeText={onChange} />
                    )}
                  />
                </View>
                <View style={styles.flex}>
                  <Controller
                    control={control}
                    name="last_name"
                    render={({ field: { onChange, value } }) => (
                      <Input label="Last Name" value={value} onChangeText={onChange} />
                    )}
                  />
                </View>
              </View>

              <Input
                label="Email"
                value={user?.email ?? ''}
                onChangeText={() => {}}
                editable={false}
              />

              <Controller
                control={control}
                name="phone"
                render={({ field: { onChange, value } }) => (
                  <Input
                    label="Phone Number"
                    value={value}
                    onChangeText={onChange}
                    keyboardType="phone-pad"
                    placeholder="(555) 123-4567"
                  />
                )}
              />

              <Controller
                control={control}
                name="address_street"
                render={({ field: { onChange, value } }) => (
                  <Input
                    label="Street Address"
                    value={value}
                    onChangeText={onChange}
                    placeholder="123 Main St"
                  />
                )}
              />

              <Controller
                control={control}
                name="address_street2"
                render={({ field: { onChange, value } }) => (
                  <Input
                    label="Street Address Line 2"
                    value={value}
                    onChangeText={onChange}
                    placeholder="Apt, Suite, Unit, etc. (optional)"
                  />
                )}
              />

              <View style={styles.fieldRow}>
                <View style={styles.flex}>
                  <Controller
                    control={control}
                    name="address_city"
                    render={({ field: { onChange, value } }) => (
                      <Input label="City" value={value} onChangeText={onChange} />
                    )}
                  />
                </View>
                <View style={styles.stateField}>
                  <Controller
                    control={control}
                    name="address_state"
                    render={({ field: { onChange, value } }) => (
                      <Input label="State" value={value} onChangeText={onChange} />
                    )}
                  />
                </View>
              </View>

              <Controller
                control={control}
                name="address_zip"
                render={({ field: { onChange, value } }) => (
                  <Input
                    label="ZIP Code"
                    value={value}
                    onChangeText={onChange}
                    keyboardType="number-pad"
                    placeholder="10001"
                  />
                )}
              />

              <Button
                title="Save Changes"
                onPress={handleSubmit(onSave)}
                loading={updateProfile.isPending}
                fullWidth
              />
            </View>

            {/* Panel 2 - Rate & Earnings */}
            <View style={[styles.panel, width >= 700 ? styles.panelRate : styles.panelRateStacked]}>
              <View style={styles.sectionHeader}>
                <View style={styles.dot} />
                <Text style={styles.sectionTitle}>Rate & Earnings</Text>
              </View>

              <Text style={styles.rateLabel}>Your Hourly Rate</Text>
              <Text style={styles.rateValue}>{rateDisplay}</Text>

              <Text style={styles.rateNote}>
                Your hourly rate is set by your employer. Contact them if you have questions.
              </Text>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Colors.bgPrimary,
  },
  flex: {
    flex: 1,
  },
  scroll: {
    paddingBottom: Spacing.xl,
  },
  heading: {
    fontSize: FontSize.xl,
    fontWeight: FontWeight.semibold,
    color: Colors.text,
    padding: Spacing.lg,
  },
  panelsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: Spacing.lg,
    gap: Spacing.lg,
  },
  panel: {
    backgroundColor: Colors.bgPanel,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.lg,
  },
  panelForm: {
    flex: 1,
    minWidth: 300,
  },
  panelRate: {
    width: 290,
    alignSelf: 'flex-start',
  },
  panelRateStacked: {
    width: '100%',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.lg,
    gap: Spacing.sm,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.accent,
  },
  sectionTitle: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.semibold,
    color: Colors.text,
  },
  fieldRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  stateField: {
    width: 100,
  },
  rateLabel: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: Spacing.xs,
  },
  rateValue: {
    fontSize: FontSize.xxl,
    fontWeight: FontWeight.semibold,
    color: Colors.accent,
  },
  rateNote: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    marginTop: Spacing.sm,
    lineHeight: 18,
  },
});
