import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock3,
  Loader2,
  Save,
  Sparkles,
} from "lucide-react";
import {
  FinancialConfigurationSchema,
  PLAN_TIERS,
  type FinancialConfiguration,
  type InvestmentPlan,
} from "@/lib/financial-config";
import { previewInvestment } from "@/lib/investment-engine";
import {
  getAdminFinancialConfiguration,
  updateFinancialConfiguration,
} from "@/lib/financial-config.functions";

type ConfigurationHistoryEntry = {
  id: string;
  actor_id: string | null;
  old_config: unknown;
  new_config: unknown;
  created_at: string;
};

type ConfigurationResponse = {
  config: FinancialConfiguration;
  history: ConfigurationHistoryEntry[];
};

type NumericDraftKey =
  | "minInvestment"
  | "maxInvestment"
  | "minDeposit"
  | "maxDeposit"
  | "minWithdrawal"
  | "maxWithdrawal";

type PlanDraft = {
  tier: InvestmentPlan["tier"];
  days: string;
  profitPct: string;
  enabled: boolean;
};

type ConfigurationDraft = Record<NumericDraftKey, string> & {
  calculationInterval: FinancialConfiguration["calculationInterval"];
  plans: PlanDraft[];
};

const numericFields: Array<{
  key: NumericDraftKey;
  label: string;
  description: string;
  suffix: string;
}> = [
  {
    key: "minInvestment",
    label: "Minimum investment",
    description: "Smallest amount accepted when opening an investment.",
    suffix: "USDT",
  },
  {
    key: "maxInvestment",
    label: "Maximum investment",
    description: "Largest amount accepted when opening an investment.",
    suffix: "USDT",
  },
  {
    key: "minDeposit",
    label: "Minimum deposit",
    description: "Smallest deposit amount in the selected native asset.",
    suffix: "native asset units",
  },
  {
    key: "maxDeposit",
    label: "Maximum deposit",
    description: "Largest deposit amount in the selected native asset.",
    suffix: "native asset units",
  },
  {
    key: "minWithdrawal",
    label: "Minimum withdrawal",
    description: "Smallest withdrawal amount in the selected native asset.",
    suffix: "native asset units",
  },
  {
    key: "maxWithdrawal",
    label: "Maximum withdrawal",
    description: "Largest withdrawal amount in the selected native asset.",
    suffix: "native asset units",
  },
];

function formatNumber(value: number) {
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 8 }).format(value);
}

function toDraft(config: FinancialConfiguration): ConfigurationDraft {
  return {
    minInvestment: String(config.minInvestment),
    maxInvestment: String(config.maxInvestment),
    minDeposit: String(config.minDeposit),
    maxDeposit: String(config.maxDeposit),
    minWithdrawal: String(config.minWithdrawal),
    maxWithdrawal: String(config.maxWithdrawal),
    calculationInterval: config.calculationInterval,
    plans: PLAN_TIERS.map((tier) => {
      const plan = config.plans.find((item) => item.tier === tier);
      return {
        tier,
        days: String(plan?.days ?? ""),
        profitPct: String(plan?.profitPct ?? ""),
        enabled: plan?.enabled ?? false,
      };
    }),
  };
}

function parseDraftNumber(value: string, label: string) {
  if (value.trim() === "") throw new Error(`${label} cannot be blank`);
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) throw new Error(`${label} must be a valid number`);
  return parsed;
}

function draftToConfiguration(draft: ConfigurationDraft, version: number): FinancialConfiguration {
  return {
    version,
    minInvestment: parseDraftNumber(draft.minInvestment, "Minimum investment"),
    maxInvestment: parseDraftNumber(draft.maxInvestment, "Maximum investment"),
    minDeposit: parseDraftNumber(draft.minDeposit, "Minimum deposit"),
    maxDeposit: parseDraftNumber(draft.maxDeposit, "Maximum deposit"),
    minWithdrawal: parseDraftNumber(draft.minWithdrawal, "Minimum withdrawal"),
    maxWithdrawal: parseDraftNumber(draft.maxWithdrawal, "Maximum withdrawal"),
    calculationInterval: draft.calculationInterval,
    returnMode: "verified_performance",
    plans: draft.plans.map((plan) => ({
      tier: plan.tier,
      days: parseDraftNumber(plan.days, `${plan.tier} duration`),
      profitPct: parseDraftNumber(plan.profitPct, `${plan.tier} projected return`),
      enabled: plan.enabled,
    })),
  };
}

function prettyJson(value: unknown) {
  if (value === undefined) return "No configuration";
  try {
    return JSON.stringify(value, null, 2) ?? "null";
  } catch {
    return String(value);
  }
}

function versionOf(value: unknown) {
  if (value && typeof value === "object" && "version" in value) {
    const version = (value as { version?: unknown }).version;
    return typeof version === "number" ? version : null;
  }
  return null;
}

export function InvestmentEngineConfiguration() {
  const queryClient = useQueryClient();
  const fetchConfiguration = useServerFn(getAdminFinancialConfiguration);
  const saveConfiguration = useServerFn(updateFinancialConfiguration);
  const configurationQuery = useQuery<ConfigurationResponse>({
    queryKey: ["admin-financial-config"],
    queryFn: async () => (await fetchConfiguration()) as ConfigurationResponse,
    staleTime: 0,
    refetchOnMount: "always",
    retry: false,
  });
  const [draft, setDraft] = useState<ConfigurationDraft | null>(null);
  const [dirty, setDirty] = useState(false);
  const [validationMessage, setValidationMessage] = useState<string | null>(null);
  const [previewPlan, setPreviewPlan] = useState(PLAN_TIERS[0]);
  const [previewAmount, setPreviewAmount] = useState("");
  const acceptedVersionRef = useRef<number | null>(null);

  const serverResponse = configurationQuery.data;
  const serverConfig = serverResponse?.config;

  // Background refreshes never replace an in-progress draft. A lower version can
  // also arrive briefly after a successful save, so ignore it until the fresh
  // response catches up.
  useEffect(() => {
    if (!serverConfig || dirty) return;
    if (acceptedVersionRef.current !== null && serverConfig.version < acceptedVersionRef.current) {
      return;
    }
    acceptedVersionRef.current = serverConfig.version;
    setDraft(toDraft(serverConfig));
  }, [serverConfig, dirty]);

  useEffect(() => {
    if (!draft || previewAmount !== "") return;
    const selected = draft.plans.find((plan) => plan.tier === previewPlan);
    if (selected) setPreviewAmount(draft.minInvestment);
  }, [draft, previewAmount, previewPlan]);

  const preview = useMemo(() => {
    if (!draft) return null;
    const plan = draft.plans.find((item) => item.tier === previewPlan);
    if (!plan) return null;
    const principal = Number(previewAmount);
    const profitPct = Number(plan.profitPct);
    if (!Number.isFinite(principal) || principal <= 0 || !Number.isFinite(profitPct)) return null;
    try {
      return { plan, ...previewInvestment(principal, profitPct) };
    } catch {
      return null;
    }
  }, [draft, previewAmount, previewPlan]);

  const saveMutation = useMutation({
    mutationFn: (payload: { expectedVersion: number; config: FinancialConfiguration }) =>
      saveConfiguration({ data: payload }),
    onSuccess: (savedConfig) => {
      acceptedVersionRef.current = savedConfig.version;
      setDraft(toDraft(savedConfig));
      setDirty(false);
      setValidationMessage(null);
      toast.success("Investment engine configuration saved");
      void queryClient.invalidateQueries({ queryKey: ["financial-config"] });
      void queryClient.invalidateQueries({ queryKey: ["admin-financial-config"] });
      void queryClient.invalidateQueries({ queryKey: ["admin-state"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const updateDraft = (update: (current: ConfigurationDraft) => ConfigurationDraft) => {
    setDraft((current) => (current ? update(current) : current));
    setDirty(true);
    setValidationMessage(null);
  };

  const handleSave = () => {
    if (!draft || !serverConfig) return;
    try {
      const expectedVersion = acceptedVersionRef.current ?? serverConfig.version;
      const config = draftToConfiguration(draft, expectedVersion);
      const result = FinancialConfigurationSchema.safeParse(config);
      if (!result.success) {
        const details = result.error.issues
          .map((issue) => `${issue.path.join(".") || "configuration"}: ${issue.message}`)
          .join("; ");
        setValidationMessage(details);
        toast.error("Check the highlighted configuration values");
        return;
      }
      saveMutation.mutate({ expectedVersion, config: result.data });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Enter valid configuration values";
      setValidationMessage(message);
      toast.error(message);
    }
  };

  const resetToServer = () => {
    if (!serverConfig) return;
    acceptedVersionRef.current = serverConfig.version;
    setDraft(toDraft(serverConfig));
    setDirty(false);
    setValidationMessage(null);
  };

  if (configurationQuery.isLoading && !draft) {
    return (
      <section className="panel mt-8 flex items-center gap-3 p-8 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin text-gold" />
        Loading financial configuration…
      </section>
    );
  }

  if (configurationQuery.error && !draft) {
    return (
      <section className="panel mt-8 p-8">
        <div className="flex items-start gap-3">
          <AlertCircle className="mt-0.5 h-5 w-5 text-bear" />
          <div>
            <h2 className="font-semibold">Financial configuration could not load</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {configurationQuery.error instanceof Error
                ? configurationQuery.error.message
                : "The protected configuration request failed."}
            </p>
            <button
              type="button"
              onClick={() => void configurationQuery.refetch()}
              className="mt-5 rounded-md bg-gold px-4 py-2 text-sm font-semibold text-primary-foreground"
            >
              Retry request
            </button>
          </div>
        </div>
      </section>
    );
  }

  if (!draft || !serverConfig) return null;

  return (
    <section className="mt-8 space-y-6" aria-labelledby="investment-engine-title">
      <div className="panel overflow-hidden">
        <div className="border-b border-border p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="flex items-center gap-2 text-gold">
                <Sparkles className="h-4 w-4" />
                <span className="text-xs font-bold uppercase tracking-[0.18em]">
                  Financial controls
                </span>
              </div>
              <h2 id="investment-engine-title" className="mt-2 text-2xl font-semibold">
                Investment Engine Configuration
              </h2>
              <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
                Configure new investment terms without rewriting existing positions. Limits are
                validated server-side and each save creates an immutable configuration history
                entry.
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground">
              {configurationQuery.isFetching && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              <span>Current version {serverConfig.version}</span>
            </div>
          </div>
          {configurationQuery.error && (
            <div className="mt-5 flex items-center justify-between gap-3 rounded-md border border-bear/30 bg-bear/10 px-3 py-2 text-sm text-bear">
              <span>Refresh failed: {configurationQuery.error.message}</span>
              <button
                type="button"
                onClick={() => void configurationQuery.refetch()}
                className="shrink-0 rounded border border-bear/40 px-2 py-1 text-xs font-semibold"
              >
                Retry
              </button>
            </div>
          )}
          {dirty && (
            <div className="mt-5 flex flex-col gap-3 rounded-md border border-gold/30 bg-gold/10 px-3 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
              <span className="text-gold">
                Unsaved changes are protected from background refreshes.
              </span>
              <button
                type="button"
                onClick={resetToServer}
                className="self-start rounded border border-border px-2.5 py-1 text-xs font-semibold hover:bg-surface-2 sm:self-auto"
              >
                Discard draft
              </button>
            </div>
          )}
        </div>

        <div className="space-y-8 p-6">
          <div>
            <div className="mb-4">
              <h3 className="font-semibold">Financial Limits</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Investment limits use USDT. Deposit and withdrawal limits use native asset units,
                matching the existing wallet settings.
              </p>
            </div>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {numericFields.map((field) => (
                <label key={field.key} className="block text-sm">
                  <span className="font-medium">{field.label}</span>
                  <span className="mt-1 block text-xs text-muted-foreground">
                    {field.description}
                  </span>
                  <div className="relative mt-2">
                    <input
                      type="number"
                      inputMode="decimal"
                      min="0"
                      step="any"
                      value={draft[field.key]}
                      onChange={(event) =>
                        updateDraft((current) => ({ ...current, [field.key]: event.target.value }))
                      }
                      className="w-full rounded-md border border-border bg-background px-3 py-2.5 pr-28 outline-none focus:border-gold"
                      aria-label={`${field.label} in ${field.suffix}`}
                    />
                    <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-muted-foreground">
                      {field.suffix}
                    </span>
                  </div>
                </label>
              ))}
            </div>
          </div>

          <div>
            <div className="mb-4">
              <h3 className="font-semibold">Investment Plans</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Each established tier is edited independently. Changes apply to new positions only;
                existing positions retain their snapshotted terms.
              </p>
            </div>
            <div className="overflow-x-auto rounded-md border border-border">
              <table className="w-full min-w-[720px] text-sm">
                <thead className="bg-surface text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3">Tier ID</th>
                    <th className="px-4 py-3">Enabled</th>
                    <th className="px-4 py-3">Duration</th>
                    <th className="px-4 py-3">Projected return</th>
                  </tr>
                </thead>
                <tbody>
                  {draft.plans.map((plan, index) => (
                    <tr key={plan.tier} className="border-t border-border">
                      <td className="px-4 py-4 font-medium">{plan.tier}</td>
                      <td className="px-4 py-4">
                        <label className="inline-flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={plan.enabled}
                            onChange={(event) =>
                              updateDraft((current) => ({
                                ...current,
                                plans: current.plans.map((item, itemIndex) =>
                                  itemIndex === index
                                    ? { ...item, enabled: event.target.checked }
                                    : item,
                                ),
                              }))
                            }
                            className="h-4 w-4 accent-gold"
                          />
                          <span className="text-xs text-muted-foreground">
                            {plan.enabled ? "Available" : "Disabled"}
                          </span>
                        </label>
                      </td>
                      <td className="px-4 py-4">
                        <label className="flex max-w-[140px] items-center gap-2">
                          <input
                            type="number"
                            min="1"
                            max="3650"
                            step="1"
                            value={plan.days}
                            onChange={(event) =>
                              updateDraft((current) => ({
                                ...current,
                                plans: current.plans.map((item, itemIndex) =>
                                  itemIndex === index
                                    ? { ...item, days: event.target.value }
                                    : item,
                                ),
                              }))
                            }
                            className="w-full rounded-md border border-border bg-background px-3 py-2 outline-none focus:border-gold"
                            aria-label={`${plan.tier} duration in days`}
                          />
                          <span className="text-xs text-muted-foreground">days</span>
                        </label>
                      </td>
                      <td className="px-4 py-4">
                        <label className="flex max-w-[180px] items-center gap-2">
                          <input
                            type="number"
                            min="0"
                            max="1000"
                            step="any"
                            value={plan.profitPct}
                            onChange={(event) =>
                              updateDraft((current) => ({
                                ...current,
                                plans: current.plans.map((item, itemIndex) =>
                                  itemIndex === index
                                    ? { ...item, profitPct: event.target.value }
                                    : item,
                                ),
                              }))
                            }
                            className="w-full rounded-md border border-border bg-background px-3 py-2 outline-none focus:border-gold"
                            aria-label={`${plan.tier} projected return percentage`}
                          />
                          <span className="text-xs text-muted-foreground">%</span>
                        </label>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(320px,0.85fr)]">
            <div>
              <div className="mb-4">
                <h3 className="font-semibold">Return Configuration</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Return mode is fixed to verified performance. Rates below are total-term simple
                  projections only, not compounded rates and never guaranteed earnings.
                </p>
              </div>
              <div className="rounded-md border border-border bg-surface/40 p-4">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="mt-0.5 h-5 w-5 text-bull" />
                  <div>
                    <p className="font-medium">Verified performance only</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Actual credited profit requires a privileged verified-performance record with
                      verifiable evidence and contractual references. Editing a rate never credits a
                      wallet or invents a return.
                    </p>
                  </div>
                </div>
              </div>
              <div className="mt-5">
                <label className="block text-sm font-medium" htmlFor="calculation-interval">
                  Calculation frequency
                </label>
                <p className="mt-1 text-xs text-muted-foreground">
                  Projection accrues only across complete intervals and uses simple total-term math.
                </p>
                <select
                  id="calculation-interval"
                  value={draft.calculationInterval}
                  onChange={(event) =>
                    updateDraft((current) => ({
                      ...current,
                      calculationInterval: event.target
                        .value as FinancialConfiguration["calculationInterval"],
                    }))
                  }
                  className="mt-2 w-full max-w-xs rounded-md border border-border bg-background px-3 py-2.5 outline-none focus:border-gold"
                >
                  <option value="hourly">Hourly</option>
                  <option value="daily">Daily</option>
                </select>
              </div>
            </div>

            <div className="rounded-md border border-gold/25 bg-gold/5 p-5">
              <div className="flex items-center gap-2 text-gold">
                <Sparkles className="h-4 w-4" />
                <h3 className="font-semibold">Projected return preview</h3>
              </div>
              <p className="mt-2 text-xs leading-5 text-muted-foreground">
                Informational total-term projection only. It is not a promise, guarantee, or actual
                credited performance.
              </p>
              <div className="mt-4 space-y-3">
                <label className="block text-sm">
                  Plan
                  <select
                    value={previewPlan}
                    onChange={(event) => setPreviewPlan(event.target.value as typeof previewPlan)}
                    className="mt-2 w-full rounded-md border border-border bg-background px-3 py-2.5 outline-none focus:border-gold"
                  >
                    {draft.plans.map((plan) => (
                      <option key={plan.tier} value={plan.tier}>
                        {plan.tier} · {plan.days || "—"} days
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block text-sm">
                  Principal (USDT)
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={previewAmount}
                    onChange={(event) => setPreviewAmount(event.target.value)}
                    className="mt-2 w-full rounded-md border border-border bg-background px-3 py-2.5 outline-none focus:border-gold"
                  />
                </label>
              </div>
              {preview ? (
                <dl className="mt-5 space-y-2 border-t border-border pt-4 text-sm">
                  <div className="flex justify-between gap-4">
                    <dt className="text-muted-foreground">Projected rate</dt>
                    <dd className="font-medium">{preview.plan.profitPct}%</dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-muted-foreground">Principal</dt>
                    <dd className="font-mono">{formatNumber(preview.principal)} USDT</dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-muted-foreground">Projected profit</dt>
                    <dd className="font-mono text-gold">
                      {formatNumber(preview.projectedProfit)} USDT
                    </dd>
                  </div>
                  <div className="flex justify-between gap-4 border-t border-border pt-2 font-semibold">
                    <dt>Total at term</dt>
                    <dd className="font-mono">{formatNumber(preview.projectedTotal)} USDT</dd>
                  </div>
                </dl>
              ) : (
                <p className="mt-5 border-t border-border pt-4 text-sm text-muted-foreground">
                  Enter a positive principal and a valid plan rate to preview the term.
                </p>
              )}
            </div>
          </div>

          {validationMessage && (
            <div className="flex items-start gap-2 rounded-md border border-bear/30 bg-bear/10 px-3 py-3 text-sm text-bear">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{validationMessage}</span>
            </div>
          )}
          {saveMutation.error && (
            <div className="flex items-start gap-2 rounded-md border border-bear/30 bg-bear/10 px-3 py-3 text-sm text-bear">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{saveMutation.error.message}</span>
            </div>
          )}
          <div className="flex flex-col gap-3 border-t border-border pt-6 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-muted-foreground">
              Saving uses expected version {acceptedVersionRef.current ?? serverConfig.version}; a
              concurrent server update will be rejected instead of overwritten.
            </p>
            <button
              type="button"
              onClick={handleSave}
              disabled={saveMutation.isPending || !dirty}
              className="inline-flex items-center justify-center gap-2 rounded-md bg-gold px-4 py-2.5 text-sm font-bold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saveMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              {saveMutation.isPending ? "Saving…" : "Save configuration"}
            </button>
          </div>
        </div>
      </div>

      <ConfigurationHistory history={serverResponse?.history ?? []} />
    </section>
  );
}

function ConfigurationHistory({ history }: { history: ConfigurationHistoryEntry[] }) {
  const sortedHistory = [...history].sort(
    (left, right) => Date.parse(right.created_at) - Date.parse(left.created_at),
  );

  return (
    <section className="panel overflow-hidden" aria-labelledby="configuration-history-title">
      <div className="border-b border-border p-6">
        <h2 id="configuration-history-title" className="font-semibold">
          Configuration History
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Immutable server records show the exact before and after configuration snapshots.
        </p>
      </div>
      {sortedHistory.length === 0 ? (
        <p className="p-6 text-sm text-muted-foreground">No configuration changes recorded yet.</p>
      ) : (
        <div className="divide-y divide-border">
          {sortedHistory.map((entry) => {
            const oldVersion = versionOf(entry.old_config);
            const newVersion = versionOf(entry.new_config);
            return (
              <details key={entry.id} className="group">
                <summary className="flex cursor-pointer list-none flex-col gap-3 px-6 py-4 hover:bg-surface-2 sm:flex-row sm:items-center sm:justify-between">
                  <span className="flex items-center gap-2">
                    <ChevronRight className="h-4 w-4 text-muted-foreground group-open:hidden" />
                    <ChevronDown className="hidden h-4 w-4 text-gold group-open:block" />
                    <span className="font-medium">
                      Version {oldVersion ?? "—"} → {newVersion ?? "—"}
                    </span>
                  </span>
                  <span className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1.5">
                      <Clock3 className="h-3.5 w-3.5" />
                      {new Date(entry.created_at).toLocaleString()}
                    </span>
                    <span>Actor: {entry.actor_id ?? "system"}</span>
                  </span>
                </summary>
                <div className="grid gap-4 border-t border-border bg-background/60 p-6 lg:grid-cols-2">
                  <div>
                    <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      Before
                    </h3>
                    <pre className="max-h-96 overflow-auto rounded-md border border-border bg-surface p-4 text-xs leading-5 text-muted-foreground">
                      {prettyJson(entry.old_config)}
                    </pre>
                  </div>
                  <div>
                    <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-gold">
                      After
                    </h3>
                    <pre className="max-h-96 overflow-auto rounded-md border border-gold/20 bg-surface p-4 text-xs leading-5 text-muted-foreground">
                      {prettyJson(entry.new_config)}
                    </pre>
                  </div>
                </div>
              </details>
            );
          })}
        </div>
      )}
    </section>
  );
}
