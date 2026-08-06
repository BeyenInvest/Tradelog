import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ChevronRight } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import { getAllProfiles } from "@/lib/admin/adminQueries";
import { toErrorMessage } from "@/lib/errorMessage";
import { dateLocale } from "@/lib/format";
import type { Profile } from "@/lib/types";

export default function AdminUsersListPage() {
  const { t, i18n } = useTranslation();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getAllProfiles()
      .then((data) => {
        if (!cancelled) setProfiles(data);
      })
      .catch((err) => {
        if (!cancelled) setError(toErrorMessage(err, t("admin.loadUsersFailed")));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <>
      <PageHeader title={t("nav.admin")} subtitle={t("admin.subtitle")} />

      <div className="flex flex-col gap-5">
        {error && (
          <Card className="border-loss/40">
            <p className="text-sm text-loss">{error}</p>
          </Card>
        )}

        {loading ? (
          <p className="text-muted text-sm">{t("common.loading")}</p>
        ) : profiles.length === 0 ? (
          <Card>
            <p className="text-sm text-muted">{t("admin.noUsers")}</p>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {profiles.map((p) => (
              <Card key={p.id} className="flex flex-col gap-3">
                <div>
                  <p className="font-display text-xl italic text-ink">{p.display_name || p.email}</p>
                  <p className="font-mono text-xs text-muted mt-1">{p.email}</p>
                </div>

                <div className="flex items-center gap-3 font-mono text-xs text-muted">
                  <span>{t("admin.planLabel", { plan: p.plan })}</span>
                  <span>{t("admin.roleLabel", { role: p.role })}</span>
                  <span>
                    {t("admin.since", {
                      date: new Date(p.created_at).toLocaleDateString(dateLocale(i18n.language), { day: "2-digit", month: "2-digit", year: "numeric" }),
                    })}
                  </span>
                </div>

                <Link
                  to={`/admin/users/${p.id}`}
                  className="flex items-center justify-center gap-1.5 mt-1 px-4 py-2 rounded-lg font-body text-sm bg-surface-2 text-ink hover:bg-ink/5"
                >
                  {t("admin.view")} <ChevronRight size={14} />
                </Link>
              </Card>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
