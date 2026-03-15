import { Award } from 'lucide-react';
import { ACHIEVEMENTS, type Achievement } from '@/lib/achievements';

interface AchievementListProps {
  achievements: readonly Achievement[];
  headingId: string;
}

/**
 * Unlocked commendations only.
 *
 * A full grid of locked entries would turn a joke calculator into a checklist,
 * so the count carries the "there are more" signal instead.
 */
export function AchievementList({ achievements, headingId }: AchievementListProps) {
  if (achievements.length === 0) {
    return null;
  }

  return (
    <section aria-labelledby={headingId} className="panel p-4 sm:p-5">
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h3 id={headingId} className="display-type text-lead text-cream-100">
          Commendations
        </h3>
        <p className="tabular text-caption text-cream-600">
          {achievements.length} of {ACHIEVEMENTS.length}
        </p>
      </div>

      <ul className="grid gap-2 sm:grid-cols-2">
        {achievements.map((achievement) => (
          <li key={achievement.id} className="flex items-start gap-3 well px-3 py-3">
            <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full border border-line-ember bg-ash-850 text-cream-100">
              <Award size={14} aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <p className="display-type text-body leading-tight text-cream-50">
                {achievement.title}
              </p>
              <p className="mt-1 text-caption leading-snug text-cream-500">{achievement.copy}</p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
