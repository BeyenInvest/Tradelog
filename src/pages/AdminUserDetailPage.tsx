import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ChevronLeft, CalendarDays, List as ListIcon } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import { ReviewStatsHeader } from "@/components/reviews/ReviewStatsHeader";
import { ReadOnlyTradeTable } from "@/components/admin/ReadOnlyTradeTable";
import { ReadOnlyDayTradesModal } from "@/components/admin/ReadOnlyDayTradesModal";
import { ReadOnlyTradeDetailModal } from "@/components/admin/ReadOnlyTradeDetailModal";
import { CalendarView } from "@/components/calendar/CalendarView";
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
  const [viewMode, setViewMode] = useState<"calendar" | "list">("calendar");
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [selectedTrade, setSelectedTrade] = useState<Trade | null>(null);

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
  const selectedDayTrades = useMemo(
    () => (selectedDay ? liveTrades.filter((t) => t.datum_open === selectedDay) : []),
    [liveTrades, selectedDay]
  );

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

            <div className="flex items-center justify-between">
              <h3 className="font-display text-lg italic text-ink">Journal trades</h3>
              <div className="inline-flex rounded-lg border border-border overflow-hidden">
                <button
                  onClick={() => setViewMode("calendar")}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-body transition-colors ${
                    viewMode === "calendar" ? "bg-gold text-on-gold" : "bg-surface-2 text-muted hover:text-ink"
                  }`}
                >
                  <CalendarDays size={14} /> Kalender
                </button>
                <button
                  onClick={() => setViewMode("list")}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-body transition-colors ${
                    viewMode === "list" ? "bg-gold text-on-gold" : "bg-surface-2 text-muted hover:text-ink"
                  }`}
                >
                  <ListIcon size={14} /> Lijst
                </button>
              </div>
            </div>

            {viewMode === "calendar" ? (
              <CalendarView trades={liveTrades} onDayClick={setSelectedDay} />
            ) : (
              <Card>
                <ReadOnlyTradeTable trades={liveTrades} onRowClick={setSelectedTrade} />
              </Card>
            )}

            <Card>
              <h3 className="font-display text-lg italic mb-3 text-ink">Backtestprojecten ({projects.length})</h3>
              {projects.length === 0 ? (
                <p className="font-body text-sm text-muted">Geen backtestprojecten.</p>
              ) : (
                <ul className="flex flex-col gap-2 font-body text-sm text-ink">
                  {projects.map((p) => (
                    <li key={p.id}>{p.naam}</li>
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
                      <p className="font-body text-sm text-ink">
                        Week {r.week_nummer}, {r.jaar} {r.titel && `— ${r.titel}`}
                      </p>
                      {r.takeaway && <p className="font-body text-xs text-muted mt-1">{r.takeaway}</p>}
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
                      <p className="font-body text-sm text-ink">
                        {r.period_type} {r.jaar} {r.titel && `— ${r.titel}`}
                      </p>
                      {r.takeaway && <p className="font-body text-xs text-muted mt-1">{r.takeaway}</p>}
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </>
        )}
      </div>

      {selectedDay && (
        <ReadOnlyDayTradesModal
          dateIso={selectedDay}
          trades={selectedDayTrades}
          onClose={() => setSelectedDay(null)}
          onSelectTrade={setSelectedTrade}
        />
      )}

      {selectedTrade && <ReadOnlyTradeDetailModal trade={selectedTrade} onClose={() => setSelectedTrade(null)} />}
    </>
  );
}
