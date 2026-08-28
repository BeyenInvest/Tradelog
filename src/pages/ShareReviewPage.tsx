import { useMemo } from "react";
import { useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { FullScreenLoading } from "@/components/ui/FullScreenLoading";
import { SharePageShell, ShareInvalidState } from "@/components/share/SharePageShell";
import { ReviewStatsHeader } from "@/components/reviews/ReviewStatsHeader";
import { ReviewErrorStats } from "@/components/reviews/ReviewErrorStats";
import { ReviewSectionsDisplay } from "@/components/reviews/ReviewSectionsDisplay";
import { ReviewTradeGroups, periodicExtraGroupModes } from "@/components/reviews/ReviewTradeGroups";
import { resolveSharedReviewSections } from "@/lib/reviewSections";
import { ResultDisplayProvider } from "@/hooks/useResultDisplay";
import { useNoIndexMeta } from "@/hooks/useNoIndexMeta";
import { useSharedToken } from "@/hooks/useSharedToken";
import { getSharedReview } from "@/lib/share/shareLinks";
import { computeErrorCounts, missedTrades, takenTrades, closedTrades } from "@/lib/stats";
import { dateLocale, tradesInResultUnit } from "@/lib/format";
import { periodLabel } from "@/lib/periodRanges";
import type { ResultUnit } from "@/lib/constants";
import type { SharedReview } from "@/lib/types";

/**
 * Public read-only review view behind a share-link token (Fase M sessie 2) —
 * the page a coach opens without an account, on its own /share/review/:token
 * route so the page knows to call get_shared_review (migration 0042). Same
 * contract as SharePage: one anonymous RPC call, a single generic message for
 * an invalid/revoked/expired token, no edit affordances, no auth-only calls.
 *
 * Unlike the journal share, the payload DOES include missed trades — the
 * review building blocks (ReviewStatsHeader/ReviewTradeGroups) show them as
 * their own badged group and keep them out of the real stats, exactly like the
 * owner's own review detail. The owner's display settings travel with the
 * payload: hide_fase via hideFaseOverride — the anonymous viewer has no profile
 * of their own. The review layout is the neutral merged one for everyone (Fase F).
 */
export default function ShareReviewPage() {
  const { token } = useParams<{ token: string }>();
  const { data, loading, failed } = useSharedToken(token, getSharedReview);

  useNoIndexMeta();

  if (loading) return <FullScreenLoading />;
  if (!data) return <ShareInvalidState failed={failed} />;
  return <SharedReviewView data={data} />;
}

function SharedReviewView({ data }: { data: SharedReview }) {
  const { t, i18n } = useTranslation();
  // Honour the owner's display unit for % and R; currency needs an account
  // saldo an anonymous session doesn't have, so it falls back to honest %.
  const unit: ResultUnit = data.result_unit === "currency" ? "percent" : data.result_unit;
  const taken = useMemo(() => takenTrades(data.trades), [data.trades]);
  const missed = useMemo(() => missedTrades(data.trades), [data.trades]);
  // Realized-stats input excludes still-running open trades (the share RPC already
  // filters them, but this narrows the type to ClosedTrade); the raw taken/missed
  // still drive the display list below.
  const takenClosed = useMemo(() => closedTrades(taken), [taken]);
  const missedClosed = useMemo(() => closedTrades(missed), [missed]);
  // Zelfde conversie als de eigen review-detail (Fase J): counts veranderen
  // niet, alleen missedResultaat — hier zonder saldo (anon).
  const errorCounts = useMemo(
    () => computeErrorCounts(taken, tradesInResultUnit(missedClosed, unit)),
    [taken, missedClosed, unit]
  );

  const title =
    data.kind === "weekly"
      ? `W${data.review.week_nummer} · ${data.review.jaar}`
      : periodLabel(data.review.period_type, data.review.jaar, data.review.periode_nummer, dateLocale(i18n.language));

  return (
    <ResultDisplayProvider override={{ unit, saldo: null }}>
      <SharePageShell maxWidthClass="max-w-4xl">
        <div>
          <h1 className="font-display text-3xl italic text-ink">{title}</h1>
          {data.review.titel && <p className="font-body text-base text-muted mt-1">{data.review.titel}</p>}
          <p className="font-body text-sm text-muted mt-1">
            {data.display_name
              ? t("share.sharedBy", { name: data.display_name })
              : t("share.sharedAnonymous")}
            {data.journal_name ? <> · {data.journal_name}</> : null}
          </p>
        </div>

        <div className="flex flex-col gap-6">
          <ReviewStatsHeader taken={takenClosed} missed={missedClosed} />
          <ReviewErrorStats {...errorCounts} />

          <section className="flex flex-col gap-4 border-t border-border pt-6">
            {data.kind === "weekly" ? (
              <ReviewSectionsDisplay
                kind="weekly"
                sections={resolveSharedReviewSections("weekly", data.sections)}
                source={data.review}
              />
            ) : (
              <ReviewSectionsDisplay
                kind="periodic"
                sections={resolveSharedReviewSections("periodic", data.sections, data.review.period_type)}
                source={data.review}
              />
            )}
          </section>

          <section className="border-t border-border pt-6">
            <p className="font-body text-xs uppercase tracking-wider text-gold mb-4">
              {t(data.kind === "weekly" ? "reviews.linkedTrades" : "reviews.tradesInPeriod", { count: taken.length + missed.length })}
            </p>
            <ReviewTradeGroups
              hideFaseOverride={data.hide_fase}
              // No live methodology on an anonymous page — own-journal reviews carry
              // a journal_name (modern), the legacy/unscoped WPM journal has null (UX-B).
              columnMode={data.journal_name != null ? "modern" : "legacy"}
              taken={taken}
              missed={missed}
              extraGroupModes={data.kind === "periodic" ? periodicExtraGroupModes(data.review.period_type) : undefined}
            />
          </section>
        </div>
      </SharePageShell>
    </ResultDisplayProvider>
  );
}
