import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import clsx from "clsx";
import { ChevronLeft } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import { ReadOnlyTradesViewer } from "@/components/admin/ReadOnlyTradesViewer";
import { ReadOnlyProjectModal } from "@/components/admin/ReadOnlyProjectModal";
import { ReadOnlyWeeklyReviewModal } from "@/components/admin/ReadOnlyWeeklyReviewModal";
import { ReadOnlyPeriodicReviewModal } from "@/components/admin/ReadOnlyPeriodicReviewModal";
import { ReadOnlyAccountList } from "@/components/admin/ReadOnlyAccountList";
import { BacktestingAnalysisView } from "@/components/backtesting/BacktestingAnalysisView";
import { ReviewList } from "@/components/reviews/ReviewList";
import { PeriodicReviewList } from "@/components/reviews/PeriodicReviewList";
import {
  getProfileById, getTradesForUser, getWeeklyReviewsForUser, getPeriodicReviewsForUser,
  getBacktestProjectsForUser, getPropAccountsForUser, getMethodologyViewForUser,
} from "@/lib/admin/adminQueries";
import { takenTrades, closedTrades, round2 } from "@/lib/stats";
import { tradesInResultUnit } from "@/lib/format";
import { ResultDisplayProvider, useResultDisplay } from "@/hooks/useResultDisplay";
import type { PeriodType } from "@/lib/constants";
import { rangeOfPeriod } from "@/lib/periodRanges";
import { toErrorMessage } from "@/lib/errorMessage";
import type { BacktestProject, MethodologyView, PeriodicReview, Payout, Profile, PropAccount, Trade, WeeklyReview } from "@/lib/types";

type MainTab = "journal" | "backtesting" | "reviews" | "accounts";
type ReviewTab = "week" | PeriodType;

const MAIN_TABS: { key: MainTab; labelKey: string }[] = [
  { key: "journal", labelKey: "nav.journal" },
  { key: "backtesting", labelKey: "nav.backtesting" },
  { key: "reviews", labelKey: "nav.reviews" },
  { key: "accounts", labelKey: "nav.accounts" },
];

const REVIEW_TABS: { key: ReviewTab; labelKey: string }[] = [
  { key: "week", labelKey: "reviews.tabWeekly" },
  { key: "month", labelKey: "reviews.tabMonthly" },
  { key: "quarter", labelKey: "reviews.tabQuarterly" },
  { key: "year", labelKey: "reviews.tabYearly" },
];

/**
 * De admin-detailpagina toont andermans trades — het eigen account-saldo van de
 * kijkende admin is daar betekenisloos, dus 'currency' wordt hier via een genest
 * provider-override teruggezet naar %. R blijft wel gelden (risk-gebaseerd, kijker-
 * onafhankelijk).
 */
export default function AdminUserDetailPage() {
  const own = useResultDisplay();
  return (
    <ResultDisplayProvider
      override={{ unit: own.unit === "currency" ? "percent" : own.unit, saldo: null }}
    >
      <AdminUserDetailPageInner />
    </ResultDisplayProvider>
  );
}

function AdminUserDetailPageInner() {
  const { t } = useTranslation();
  const { userId } = useParams<{ userId: string }>();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [methodologyView, setMethodologyView] = useState<MethodologyView | null>(null);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [weeklyReviews, setWeeklyReviews] = useState<WeeklyReview[]>([]);
  const [periodicReviews, setPeriodicReviews] = useState<PeriodicReview[]>([]);
  const [projects, setProjects] = useState<BacktestProject[]>([]);
  const [accounts, setAccounts] = useState<PropAccount[]>([]);
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [mainTab, setMainTab] = useState<MainTab>("journal");
  const [journalTab, setJournalTab] = useState<"journal" | "analyse">("journal");
  const [reviewTab, setReviewTab] = useState<ReviewTab>("week");

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
      getPropAccountsForUser(userId),
    ])
      .then(async ([p, t, wr, pr, bp, pa]) => {
        if (cancelled) return;
        setProfile(p);
        setTrades(t);
        setWeeklyReviews(wr);
        setPeriodicReviews(pr);
        setProjects(bp);
        setAccounts(pa.accounts);
        setPayouts(pa.payouts);
        // The Analyse breakdowns are journal-type-specific: load the viewed user's
        // active-journal view so they don't follow the admin's own journal (H2).
        const mv = await getMethodologyViewForUser(p?.methodology_id ?? null);
        if (!cancelled) setMethodologyView(mv);
      })
      .catch((err) => {
        if (!cancelled) setError(toErrorMessage(err, t("admin.loadUserDataFailed")));
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
  // Also scoped to the viewed user's ACTIVE journal (H2/B1) — the same filter
  // useTrades applies for the user themselves; without it the admin Analyse,
  // calendar and review-badges mix every journal of the viewed user into one pot.
  const liveTrades = useMemo(
    () =>
      trades.filter(
        (t) => t.backtest_project_id === null && t.methodology_id === (profile?.methodology_id ?? null)
      ),
    [trades, profile]
  );
  const taken = useMemo(() => takenTrades(liveTrades), [liveTrades]);

  const tradesByWeeklyReview = useMemo(() => {
    const m = new Map<string, Trade[]>();
    for (const t of liveTrades) {
      if (!t.weekly_review_id) continue;
      const bucket = m.get(t.weekly_review_id) ?? [];
      bucket.push(t);
      m.set(t.weekly_review_id, bucket);
    }
    return m;
  }, [liveTrades]);

  // Review-badges in de eenheid van de kijkende admin (Fase J) — ReviewList/
  // PeriodicReviewList formatteren in dezelfde eenheid, dus de som moet mee.
  // (Binnen de override hierboven: currency is hier al teruggezet naar %.)
  const { unit: resultUnit } = useResultDisplay();
  const weeklyStats = useMemo(() => {
    const m = new Map<string, { resultaat: number; count: number }>();
    for (const r of weeklyReviews) {
      const rt = tradesInResultUnit(closedTrades(takenTrades(tradesByWeeklyReview.get(r.id) ?? [])), resultUnit);
      m.set(r.id, { resultaat: round2(rt.reduce((s, t) => s + t.resultaat_pct, 0)), count: rt.length });
    }
    return m;
  }, [weeklyReviews, tradesByWeeklyReview, resultUnit]);

  const periodicReviewsForTab = useMemo(
    () => (reviewTab === "week" ? [] : periodicReviews.filter((r) => r.period_type === reviewTab)),
    [periodicReviews, reviewTab]
  );

  const periodicStats = useMemo(() => {
    const m = new Map<string, { resultaat: number; count: number }>();
    for (const r of periodicReviewsForTab) {
      const { start, end } = rangeOfPeriod(r.period_type, r.jaar, r.periode_nummer);
      const rt = tradesInResultUnit(closedTrades(takenTrades(liveTrades.filter((t) => t.datum_open >= start && t.datum_open <= end))), resultUnit);
      m.set(r.id, { resultaat: round2(rt.reduce((s, t) => s + t.resultaat_pct, 0)), count: rt.length });
    }
    return m;
  }, [periodicReviewsForTab, liveTrades, resultUnit]);

  return (
    <>
      <PageHeader
        title={profile ? profile.display_name || profile.email : t("admin.userFallback")}
        subtitle={profile ? t("admin.readOnlySubtitle", { email: profile.email }) : undefined}
        action={
          <Link to="/admin" className="flex items-center gap-1.5 text-sm font-body text-muted hover:text-ink">
            <ChevronLeft size={16} /> {t("admin.backToUsers")}
          </Link>
        }
      />

      {error && (
        <Card className="border-loss/40 mb-5">
          <p className="text-sm text-loss">{error}</p>
        </Card>
      )}

      {loading ? (
        <p className="text-muted text-sm">{t("common.loading")}</p>
      ) : (
        <div className="flex flex-col gap-5">
          <div className="inline-flex rounded-lg border border-border overflow-hidden w-fit">
            {MAIN_TABS.map((item) => (
              <button
                key={item.key}
                onClick={() => setMainTab(item.key)}
                className={`px-4 py-2 text-sm font-body ${mainTab === item.key ? "bg-gold text-on-gold" : "bg-surface-2 text-muted"}`}
              >
                {t(item.labelKey)}
              </button>
            ))}
          </div>

          {mainTab === "journal" && (
            <div className="flex flex-col gap-5">
              <div className="inline-flex rounded-lg border border-border overflow-hidden w-fit">
                <button
                  onClick={() => setJournalTab("journal")}
                  className={`px-4 py-2 text-sm font-body ${journalTab === "journal" ? "bg-gold text-on-gold" : "bg-surface-2 text-muted"}`}
                >
                  {t("journal.tabJournal")}
                </button>
                <button
                  onClick={() => setJournalTab("analyse")}
                  className={`px-4 py-2 text-sm font-body ${journalTab === "analyse" ? "bg-gold text-on-gold" : "bg-surface-2 text-muted"}`}
                >
                  {t("journal.tabAnalyse")}
                </button>
              </div>

              {journalTab === "journal" ? (
                <ReadOnlyTradesViewer trades={liveTrades} title={t("admin.journalTradesTitle")} />
              ) : (
                <BacktestingAnalysisView
                  trades={taken}
                  hideFaseOverride={profile?.hide_fase}
                  methodologyOverride={methodologyView ?? undefined}
                  showAdherence
                />
              )}
            </div>
          )}

          {mainTab === "backtesting" && (
            <Card>
              <h3 className="font-display text-lg italic mb-3 text-ink">{t("admin.backtestProjects", { count: projects.length })}</h3>
              {projects.length === 0 ? (
                <p className="font-body text-sm text-muted">{t("backtesting.noProjects")}</p>
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
          )}

          {mainTab === "reviews" && (
            <div className="flex flex-col gap-5">
              <div className="flex gap-1 border-b border-border">
                {REVIEW_TABS.map((item) => (
                  <button
                    key={item.key}
                    onClick={() => setReviewTab(item.key)}
                    className={clsx(
                      "px-4 py-2 font-body text-sm -mb-px border-b-2 transition-colors",
                      reviewTab === item.key ? "border-gold text-ink" : "border-transparent text-muted"
                    )}
                  >
                    {t(item.labelKey)}
                  </button>
                ))}
              </div>

              {reviewTab === "week" ? (
                <ReviewList
                  reviews={weeklyReviews}
                  selectedId={selectedWeeklyReview?.id ?? null}
                  onSelect={(id) => setSelectedWeeklyReview(weeklyReviews.find((r) => r.id === id) ?? null)}
                  resultaatOf={(r) => weeklyStats.get(r.id)?.resultaat ?? 0}
                  tradeCountOf={(r) => weeklyStats.get(r.id)?.count ?? 0}
                />
              ) : (
                <PeriodicReviewList
                  periodType={reviewTab}
                  reviews={periodicReviewsForTab}
                  selectedId={selectedPeriodicReview?.id ?? null}
                  onSelect={(id) => setSelectedPeriodicReview(periodicReviewsForTab.find((r) => r.id === id) ?? null)}
                  resultaatOf={(r) => periodicStats.get(r.id)?.resultaat ?? 0}
                  tradeCountOf={(r) => periodicStats.get(r.id)?.count ?? 0}
                />
              )}
            </div>
          )}

          {mainTab === "accounts" && <ReadOnlyAccountList accounts={accounts} payouts={payouts} />}
        </div>
      )}

      {selectedProject && (
        <ReadOnlyProjectModal
          project={selectedProject}
          trades={trades.filter((t) => t.backtest_project_id === selectedProject.id)}
          hideFaseOverride={profile?.hide_fase}
          methodologyOverride={methodologyView ?? undefined}
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
