import { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useForm, Controller } from 'react-hook-form';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import {
  useBusinessSettings,
  useUpdateBusinessSettings,
} from '@/hooks/useBusinessSettings';
import { Colors, Spacing, FontSize, BorderRadius } from '@/constants/theme';

interface CompanyForm {
  company_name: string;
  company_address: string;
  company_email: string;
  company_phone: string;
  payment_instructions: string;
}

export default function SettingsScreen() {
  const { data: settings } = useBusinessSettings();
  const updateSettings = useUpdateBusinessSettings();

  const [apiKey, setApiKey] = useState('');
  const [savingKey, setSavingKey] = useState(false);

  const { control, handleSubmit, reset } = useForm<CompanyForm>({
    defaultValues: {
      company_name: '',
      company_address: '',
      company_email: '',
      company_phone: '',
      payment_instructions: '',
    },
  });

  useEffect(() => {
    if (settings) {
      reset({
        company_name: settings.company_name ?? '',
        company_address: settings.company_address ?? '',
        company_email: settings.company_email ?? '',
        company_phone: settings.company_phone ?? '',
        payment_instructions: settings.payment_instructions ?? '',
      });
      setApiKey(settings.openai_api_key ?? '');
    }
  }, [settings, reset]);

  const onSaveCompany = async (data: CompanyForm) => {
    try {
      await updateSettings.mutateAsync(data);
      Alert.alert('Success', 'Settings updated');
    } catch {
      Alert.alert('Error', 'Failed to update settings');
    }
  };

  const onSaveApiKey = async () => {
    setSavingKey(true);
    try {
      await updateSettings.mutateAsync({ openai_api_key: apiKey });
      Alert.alert('Success', 'API key saved');
    } catch {
      Alert.alert('Error', 'Failed to save API key');
    } finally {
      setSavingKey(false);
    }
  };

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
          <Text style={styles.viewHeader}>Business Settings</Text>

          <View style={styles.panelRow}>
            {/* Company Information */}
            <View style={styles.panel}>
              <View style={styles.sectionHeader}>
                <View style={styles.accentDot} />
                <Text style={styles.sectionTitle}>Company Information</Text>
              </View>

              <Controller
                control={control}
                name="company_name"
                render={({ field: { onChange, value } }) => (
                  <Input
                    label="Company Name"
                    value={value}
                    onChangeText={onChange}
                    placeholder="Your company name"
                  />
                )}
              />
              <Controller
                control={control}
                name="company_address"
                render={({ field: { onChange, value } }) => (
                  <Input
                    label="Company Address"
                    value={value}
                    onChangeText={onChange}
                    multiline
                    placeholder="Street address, city, state, zip"
                  />
                )}
              />

              <View style={styles.fieldRow}>
                <View style={styles.fieldHalf}>
                  <Controller
                    control={control}
                    name="company_email"
                    render={({ field: { onChange, value } }) => (
                      <Input
                        label="Company Email"
                        value={value}
                        onChangeText={onChange}
                        keyboardType="email-address"
                        placeholder="email@company.com"
                      />
                    )}
                  />
                </View>
                <View style={styles.fieldHalf}>
                  <Controller
                    control={control}
                    name="company_phone"
                    render={({ field: { onChange, value } }) => (
                      <Input
                        label="Company Phone"
                        value={value}
                        onChangeText={onChange}
                        keyboardType="phone-pad"
                        placeholder="(555) 123-4567"
                      />
                    )}
                  />
                </View>
              </View>

              <Controller
                control={control}
                name="payment_instructions"
                render={({ field: { onChange, value } }) => (
                  <Input
                    label="Payment Instructions"
                    value={value}
                    onChangeText={onChange}
                    multiline
                    placeholder="Bank details, payment methods accepted, etc."
                  />
                )}
              />

              <View style={styles.saveButtonContainer}>
                <Button
                  title="Save Settings"
                  onPress={handleSubmit(onSaveCompany)}
                  loading={updateSettings.isPending && !savingKey}
                />
              </View>
            </View>

            {/* AI / Video Processing */}
            <View style={styles.panel}>
              <View style={styles.sectionHeader}>
                <View style={styles.accentDot} />
                <Text style={styles.sectionTitle}>AI / Video Processing</Text>
              </View>

              <Text style={styles.panelDescription}>
                Used for auto-generating task lists from uploaded videos. Your
                key is stored in the database and only visible to admins.
              </Text>

              <Input
                label="OpenAI API Key"
                value={apiKey}
                onChangeText={setApiKey}
                secureTextEntry
                placeholder="sk-..."
              />

              <View style={styles.saveButtonRight}>
                <Button
                  title="Save API Key"
                  onPress={onSaveApiKey}
                  loading={savingKey}
                />
              </View>
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
    paddingBottom: Spacing.xxl,
  },
  viewHeader: {
    fontSize: FontSize.xl,
    fontWeight: '600',
    color: Colors.text,
    padding: Spacing.lg,
    paddingBottom: 0,
  },
  panelRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: Spacing.lg,
    gap: Spacing.lg,
  },
  panel: {
    backgroundColor: Colors.bgPanel,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.lg,
    flex: 1,
    minWidth: 300,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  accentDot: {
    width: 8,
    height: 8,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.accent,
  },
  sectionTitle: {
    fontSize: FontSize.md,
    fontWeight: '600',
    color: Colors.text,
  },
  panelDescription: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    marginBottom: Spacing.md,
    lineHeight: 20,
  },
  fieldRow: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  fieldHalf: {
    flex: 1,
  },
  saveButtonContainer: {
    alignItems: 'center',
    marginTop: Spacing.sm,
  },
  saveButtonRight: {
    alignItems: 'flex-end',
    marginTop: Spacing.sm,
  },
});
