import { useTranslation } from "react-i18next";
import {
  BookOpen, LineChart, Target, NotebookPen, Wallet, CalendarClock, Calculator,
  Layers, Percent, Scale, EyeOff, Settings, Mail,
  SlidersHorizontal, Sparkles, FolderPlus, ListChecks, Palette, Landmark, type LucideIcon,
} from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import { SUPPORT_EMAIL } from "@/lib/constants";

/**
 * In-app guide (Fase onboarding). A single reference page explaining every tool
 * and a few core concepts, so a new user is never stuck wondering what a section
 * does. Copy lives in the `help` i18n namespace; each entry maps an icon to a
 * title/body key. Reached from the sidebar's bottom cluster (next to Settings).
 */
const TOOLS: { id: string; icon: LucideIcon }[] = [
  { id: "journal", icon: BookOpen },
  { id: "analyse", icon: LineChart },
  { id: "backtesting", icon: Target },
  { id: "reviews", icon: NotebookPen },
  { id: "accounts", icon: Wallet },
  { id: "calendar", icon: CalendarClock },
  { id: "lotSize", icon: Calculator },
];

const CUSTOMIZE: { id: string; icon: LucideIcon }[] = [
  { id: "fields", icon: SlidersHorizontal },
  { id: "presets", icon: Sparkles },
  { id: "multiJournals", icon: FolderPlus },
  { id: "reviewSections", icon: ListChecks },
  { id: "advancedAnalysis", icon: LineChart },
  { id: "display", icon: Palette },
  { id: "instruments", icon: Landmark },
];

const CONCEPTS: { id: string; icon: LucideIcon }[] = [
  { id: "journals", icon: Layers },
  { id: "resultUnit", icon: Percent },
  { id: "evaluation", icon: Scale },
  { id: "missed", icon: EyeOff },
  { id: "settings", icon: Settings },
];

export default function HelpPage() {
  const { t } = useTranslation();

  return (
    <div className="max-w-3xl">
      <PageHeader title={t("help.title")} subtitle={t("help.subtitle")} />

      <Card className="mb-8 border-gold/25 bg-gold/[0.04]">
        <p className="font-body text-sm text-ink leading-relaxed">{t("help.intro")}</p>
      </Card>

      <Section heading={t("help.toolsHeading")} entries={TOOLS} />
      <Section heading={t("help.customizeHeading")} entries={CUSTOMIZE} />
      <Section heading={t("help.conceptsHeading")} entries={CONCEPTS} />

      <Card className="mt-8 flex flex-col gap-2">
        <h2 className="font-body text-sm font-semibold text-ink">{t("help.contactHeading")}</h2>
        <p className="font-body text-sm text-muted">
          {t("help.contactBody")}{" "}
          <a href={`mailto:${SUPPORT_EMAIL}`} className="inline-flex items-center gap-1.5 text-gold hover:underline">
            <Mail size={14} /> {SUPPORT_EMAIL}
          </a>
        </p>
      </Card>
    </div>
  );
}

function Section({ heading, entries }: { heading: string; entries: { id: string; icon: LucideIcon }[] }) {
  const { t } = useTranslation();
  return (
    <section className="mb-8">
      <h2 className="font-mono text-[11px] uppercase tracking-[0.2em] text-gold mb-3">{heading}</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        {entries.map(({ id, icon: Icon }) => (
          <Card key={id} className="flex items-start gap-3.5">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gold/10">
              <Icon size={17} className="text-gold" />
            </div>
            <div className="min-w-0">
              <h3 className="font-body text-sm font-semibold text-ink">{t(`help.items.${id}.title`)}</h3>
              <p className="font-body text-sm text-muted leading-relaxed mt-0.5">{t(`help.items.${id}.body`)}</p>
            </div>
          </Card>
        ))}
      </div>
    </section>
  );
}
