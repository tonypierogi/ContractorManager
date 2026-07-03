import { useState, useEffect, useRef } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '@/lib/auth-provider';
import { useCurrentClockIn, useClockIn, useClockOut, useTodayStats } from '@/hooks/useTimeClock';
import ClockButton from '@/components/timeclock/ClockButton';
import TodayStats from '@/components/timeclock/TodayStats';
import Button from '@/components/ui/Button';
import { Colors, Spacing, FontSize, FontWeight, BorderRadius, Shadows } from '@/constants/theme';
import { formatTime } from '@/utils/format';

function useCurrentTime() {
  const [now, setNow] = useState(new Date());
  const interval = useRef<ReturnType<typeof setInterval>>(undefined);

  useEffect(() => {
    interval.current = setInterval(() => setNow(new Date()), 1000);
    return () => {
      if (interval.current) clearInterval(interval.current);
    };
  }, []);

  return now;
}

function formatClockTime(date: Date): string {
  return date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  });
}

function formatElapsedDuration(startTime: string): string {
  const diffMs = Date.now() - new Date(startTime).getTime();
  const totalSec = Math.max(0, Math.floor(diffMs / 1000));
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return [h, m, s].map((v) => String(v).padStart(2, '0')).join(':');
}

export default function TimeClockScreen() {
  const { user, profile } = useAuth();
  const userId = user?.id ?? '';
  const { data: currentClockIn } = useCurrentClockIn(userId);
  const clockIn = useClockIn();
  const clockOut = useClockOut();
  const { data: todayStats } = useTodayStats(userId);
  const now = useCurrentTime();

  const isClockedIn = !!currentClockIn;
  const hourlyRate = profile?.hourly_rate ?? 0;
  const totalHours = todayStats?.totalHours ?? 0;
  const estimatedEarnings = totalHours * hourlyRate;

  const today = now.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  const handleClockToggle = () => {
    if (isClockedIn && currentClockIn) {
      clockOut.mutate({ entryId: currentClockIn.id, userId });
    } else {
      clockIn.mutate(userId);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={[]}>
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Text style={styles.heading}>Time Clock</Text>
          <Text style={styles.subtitle}>{today}</Text>
        </View>

        <View style={styles.clockContainer}>
          <View style={styles.clockDisplay}>
            <Text style={styles.clockLabel}>CURRENT TIME</Text>
            <Text style={styles.clockTime}>{formatClockTime(now)}</Text>
            <Text style={[styles.statusText, isClockedIn && styles.statusActive]}>
              {isClockedIn ? 'Currently clocked in' : 'Not clocked in'}
            </Text>
          </View>

          <View style={styles.clockActions}>
            <ClockButton
              isClockedIn={isClockedIn}
              onPress={handleClockToggle}
              loading={clockIn.isPending || clockOut.isPending}
            />
            <Button
              title="Add Manual Shift"
              variant="secondary"
              size="sm"
              onPress={() => {}}
            />
          </View>

          {isClockedIn && currentClockIn && (
            <View style={styles.sessionInfo}>
              <View style={styles.sessionStat}>
                <Text style={styles.sessionLabel}>Clocked in at</Text>
                <Text style={styles.sessionValue}>{formatTime(currentClockIn.clock_in)}</Text>
              </View>
              <View style={styles.sessionStat}>
                <Text style={styles.sessionLabel}>Time worked</Text>
                <Text style={[styles.sessionValue, styles.sessionAccent]}>
                  {formatElapsedDuration(currentClockIn.clock_in)}
                </Text>
              </View>
            </View>
          )}
        </View>

        <TodayStats
          totalHours={totalHours}
          estimatedEarnings={estimatedEarnings}
          hourlyRate={hourlyRate}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Colors.bgPrimary,
  },
  container: {
    flex: 1,
  },
  content: {
    padding: Spacing.lg,
  },
  header: {
    marginBottom: Spacing.xl,
  },
  heading: {
    fontSize: FontSize.xl,
    fontWeight: FontWeight.bold,
    color: Colors.text,
  },
  subtitle: {
    fontSize: FontSize.md,
    color: Colors.textSecondary,
    marginTop: Spacing.xs,
  },
  clockContainer: {
    backgroundColor: Colors.bgPanel,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.xl,
    alignItems: 'center',
    ...Shadows.md,
  },
  clockDisplay: {
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  clockLabel: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: Spacing.sm,
  },
  clockTime: {
    fontSize: FontSize.clock,
    fontWeight: FontWeight.medium,
    color: Colors.text,
    fontVariant: ['tabular-nums'],
    letterSpacing: 1,
  },
  statusText: {
    fontSize: FontSize.sm,
    color: Colors.textMuted,
    marginTop: Spacing.sm,
  },
  statusActive: {
    color: Colors.success,
  },
  clockActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    marginBottom: Spacing.lg,
  },
  sessionInfo: {
    flexDirection: 'row',
    gap: Spacing.lg,
    backgroundColor: Colors.bgElevated,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    width: '100%',
  },
  sessionStat: {
    flex: 1,
    alignItems: 'center',
  },
  sessionLabel: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    marginBottom: Spacing.xs,
  },
  sessionValue: {
    fontSize: FontSize.md,
    color: Colors.text,
  },
  sessionAccent: {
    color: Colors.accent,
  },
});
