import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

interface ResultMetricProps {
  label: string;
  value: string;
  detail?: string;
  emphasis?: 'major' | 'normal';
  tone?: 'neutral' | 'positive' | 'negative' | 'accent';
  icon?: ReactNode;
}

const TONES: Record<NonNullable<ResultMetricProps['tone']>, string> = {
  neutral: 'text-cream-50',
  positive: 'text-sesame-400',
  negative: 'text-char-500',
  accent: 'text-ember-400',
};

export function ResultMetric({
  label,
  value,
  detail,
  emphasis = 'normal',
  tone = 'neutral',
  icon,
}: ResultMetricProps) {
  return (
    <div
      className={cn(
        'rounded-card border border-line bg-ash-850 p-4',
        emphasis === 'major' && 'bg-ash-800',
      )}
    >
      <div className="flex items-center gap-1.5">
        {icon}
        <p className="micro-label">{label}</p>
      </div>
      <p
        className={cn(
          'tabular display-type mt-1.5 break-words',
          emphasis === 'major' ? 'text-4xl sm:text-5xl' : 'text-2xl sm:text-3xl',
          TONES[tone],
        )}
      >
        {value}
      </p>
      {detail && <p className="tabular mt-1 text-xs leading-snug text-cream-700">{detail}</p>}
    </div>
  );
}
