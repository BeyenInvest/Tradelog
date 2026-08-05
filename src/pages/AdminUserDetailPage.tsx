import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ChevronLeft } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import { ReviewStatsHeader } from "@/components/reviews/ReviewStatsHeader";
import { ReadOnlyTradesViewer } from "@/components/admin/ReadOnlyTradesViewer";
import { ReadOnlyProjectModal } from "@/components/admin/ReadOnlyProjectModal";
import { ReadOnlyWeeklyReviewModal } from "@/components/admin/ReadOnlyWeeklyReviewModal";
import { ReadOnlyPeriodicReviewModal } from "@/components/admin/ReadOnlyPeriodicReviewModal";
import {
  getProfileById, getTradesForUser, getWeeklyReviewsForUser, getPeriodicReviewsForUser, getBacktestProjectsForUser,
} from "@/lib/admin/adminQueries";
import { takenTrades, missedTrades } from "@/lib/stats";
import { toErrorMessage } from "@/lib/errorMessage";
import type { BacktestProject, PeriodicReview, Profile, Trade, WeeklyReview } from "@/lib/types";

export default function AdminUserDetailPage() {
  const { userId } = useParams<{ userId: string }>();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [weeklyReviews, setWeeklyReviews] = useState<WeeklyReview[]>([]);
  const [periodicReviews, setPeriodicReviews] = useState<PeriodicReview[]>([]);
  const [projects, setProjects] = useState<BacktestProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedProject, setSelectedProject] = useState<BacktestProject | null>(null);
  const [selectedWeeklyReview, setSelectedWeeklyReview] = useState<WeeklyReview | null>(null);
  const [selectedPeriodicReview, setSelectedPeriodicReview] = useState<PeriodicReview | null>(null);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    setLoading(true);
    Promise.all([
      getProfileById(userId),
      getTradesForUser(userId),
      getWeeklyReviewsForUser(userId),
      getPeriodicReviewsForUser(userId),
      getBacktestProjectsForUser(userId),
    ])
      .then(([p, t, wr, pr, bp]) => {
        if (cancelled) return;
        setProfile(p);
        setTrades(t);
        setWeeklyReviews(wr);
        setPeriodicReviews(pr);
        setProjects(bp);
      })
      .catch((err) => {
        if (!cancelled) setError(toErrorMessage(err, "Laden van gebruikersdata is mislukt"));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  // Same "live Journal only" scope as JournalPage — backtest-project trades get their own
  // isolated view, and missed trades stay separate from real performance (see CLAUDE.md).
  const liveTrades = trades.filter((t) => t.backtest_project_id === null);
  const taken = takenTrades(liveTrades);
  const missed = missedTrades(liveTrades);

  return (
    <>
      <PageHeader
        title={profile ? profile.display_name || profile.email : "Gebruiker"}
        subtitle={profile ? `${profile.email} — alleen-lezen` : undefined}
        action={
          <Link to="/admin" className="flex items-center gap-1.5 text-sm font-body text-muted hover:text-ink">
            <ChevronLeft size={16} /> Terug naar gebruikers
          </Link>
        }
      />

      <div className="flex flex-col gap-6">
        {error && (
          <Card className="border-loss/40">
            <p className="text-sm text-loss">{error}</p>
          </Card>
        )}

        {loading ? (
          <p className="text-muted text-sm">Laden...</p>
        ) : (
          <>
            <ReviewStatsHeader taken={taken} missed={missed} />

            <ReadOnlyTradesViewer trades={liveTrades} title="Journal trades" />

            <Card>
              <h3 className="font-display text-lg italic mb-3 text-ink">Backtestprojecten ({projects.length})</h3>
              {projects.length === 0 ? (
                <p className="font-body text-sm text-muted">Geen backtestprojecten.</p>
              ) : (
                <ul className="flex flex-col gap-2 font-body text-sm">
                  {projects.map((p) => (
                    <li key={p.id}>
                      <button
                        onClick={() => setSelectedProject(p)}
                        className="text-ink hover:text-gold underline-offset-2 hover:underline"
                      >
                        {p.naam}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            <Card>
              <h3 className="font-display text-lg italic mb-3 text-ink">Weekly reviews ({weeklyReviews.length})</h3>
              {weeklyReviews.length === 0 ? (
                <p className="font-body text-sm text-muted">Geen weekly reviews.</p>
              ) : (
                <ul className="flex flex-col gap-3">
                  {weeklyReviews.map((r) => (
                    <li key={r.id} className="border-b border-border/50 pb-2 last:border-0">
                      <button onClick={() => setSelectedWeeklyReview(r)} className="text-left w-full">
                        <p className="font-body text-sm text-ink hover:text-gold">
                          Week {r.week_nummer}, {r.jaar} {r.titel && `— ${r.titel}`}
                        </p>
                        {r.takeaway && <p className="font-body text-xs text-muted mt-1">{r.takeaway}</p>}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            <Card>
              <h3 className="font-display text-lg italic mb-3 text-ink">Periodic reviews ({periodicReviews.length})</h3>
              {periodicReviews.length === 0 ? (
                <p className="font-body text-sm text-muted">Geen periodic reviews.</p>
              ) : (
                <ul className="flex flex-col gap-3">
                  {periodicReviews.map((r) => (
                    <li key={r.id} className="border-b border-border/50 pb-2 last:border-0">
                      <button onClick={() => setSelectedPeriodicReview(r)} className="text-left w-full">
                        <p className="font-body text-sm text-ink hover:text-gold">
                          {r.period_type} {r.jaar} {r.titel && `— ${r.titel}`}
                        </p>
                        {r.takeaway && <p className="font-body text-xs text-muted mt-1">{r.takeaway}</p>}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </>
        )}
      </div>

      {selectedProject && (
        <ReadOnlyProjectModal
          project={selectedProject}
          trades={trades.filter((t) => t.backtest_project_id === selectedProject.id)}
          onClose={() => setSelectedProject(null)}
        />
      )}

      {selectedWeeklyReview && (
        <ReadOnlyWeeklyReviewModal review={selectedWeeklyReview} trades={liveTrades} onClose={() => setSelectedWeeklyReview(null)} />
      )}

      {selectedPeriodicReview && (
        <ReadOnlyPeriodicReviewModal review={selectedPeriodicReview} trades={liveTrades} onClose={() => setSelectedPeriodicReview(null)} />
      )}
    </>
  );
}
