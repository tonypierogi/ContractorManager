import React, { useState, useEffect, useRef } from 'react';
import { Text, StyleSheet } from 'react-native';
import { Colors, FontSize, FontWeight } from '@/constants/theme';

interface LiveTimerProps {
  startTime: string;
}

function formatElapsed(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return [h, m, s].map((v) => String(v).padStart(2, '0')).join(':');
}

export default function LiveTimer({ startTime }: LiveTimerProps) {
  const [elapsed, setElapsed] = useState(0);
  const interval = useRef<ReturnType<typeof setInterval>>(undefined);

  useEffect(() => {
    const start = new Date(startTime).getTime();

    const tick = () => {
      const diff = Math.max(0, Math.floor((Date.now() - start) / 1000));
      setElapsed(diff);
    };

    tick();
    interval.current = setInterval(tick, 1000);

    return () => {
      if (interval.current) clearInterval(interval.current);
    };
  }, [startTime]);

  return <Text style={styles.timer}>{formatElapsed(elapsed)}</Text>;
}

const styles = StyleSheet.create({
  timer: {
    fontSize: FontSize.clock,
    fontWeight: FontWeight.bold,
    fontVariant: ['tabular-nums'],
    color: Colors.text,
    textAlign: 'center',
    letterSpacing: 2,
  },
});
