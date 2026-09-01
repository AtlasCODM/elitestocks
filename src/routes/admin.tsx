/* eslint-disable @typescript-eslint/no-explicit-any -- admin response types come from the migration added here. */
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Clock3, Loader2, ShieldCheck, XCircle } from "lucide-react";
import { Header } from "@/components/site/Header";
import { useAuth } from "@/hooks/useAuth";
import {
  deleteAdminUser,
  getAdminState,
  listAdminUsers,
  updateAdminSettings,
  updateAdminTransaction,
} from "@/lib/admin.functions";

export const Route = createFileRoute("/admin")({ component: AdminPage });
type Tab = "overview" | "transactions" | "users" | "settings";
const pendingStatuses = ["pending", "pending_confirmation", "verifying"];

function AdminPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const fetchAdmin = useServerFn(getAdminState);
  const [tab, setTab] = useState<Tab>("overview");
  const query = useQuery({
    queryKey: ["admin-state", user?.id],
    queryFn: () => fetchAdmin(),
    enabled: !!user,
    staleTime: 0,
    refetchOnMount: "always",
    retry: false,
  });
  const fetchUsers = useServerFn(listAdminUsers);
  const usersQuery = useQuery({
    queryKey: ["admin-users", user?.id],
    queryFn: () => fetchUsers(),
    enabled: !!user && tab === "users",
    staleTime: 0,
    refetchOnMount: "always",
  });
  useEffect(() => {
    if (!loading && !user) navigate({ to: "/login" });
  }, [loading, user, navigate]);
  if (loading || !user) return <div className="min-h-screen bg-background" />;
  if (query.isLoading)
    return (
      <>
        <Header />
        <main className="mx-auto max-w-7xl p-6">
          <Loader2 className="animate-spin text-gold" />
        </main>
      </>
    );
  if (query.error)
    return (
      <>
        <Header />
        <main className="mx-auto max-w-7xl p-6">
          <div className="panel p-8 text-center">
            <ShieldCheck className="mx-auto h-10 w-10 text-bear" />
            <h1 className="mt-4 text-xl font-semibold">Admin dashboard could not load</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {query.error instanceof Error
                ? query.error.message
                : "The protected dashboard request failed."}
            </p>
            <button
              type="button"
              onClick={() => query.refetch()}
              className="mt-5 rounded-md bg-gold px-4 py-2 text-sm font-semibold text-primary-foreground"
            >
              Retry request
            </button>
          </div>
        </main>
      </>
    );
  const state = query.data;
  const pending =
    state?.transactions.filter((tx: any) => pendingStatuses.includes(tx.status)) ?? [];
  const tabs: { id: Tab; label: string }[] = [
    { id: "overview", label: "Overview" },
    { id: "transactions", label: "Transactions" },
    { id: "users", label: "Users" },
    { id: "settings", label: "Settings" },
  ];
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="mx-auto max-w-7xl px-4 py-8 lg:px-6">
        <div className="flex flex-col gap-4 border-b border-border pb-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="flex items-center gap-2 text-gold">
              <ShieldCheck className="h-5 w-5" />
              <span className="text-xs font-bold uppercase tracking-[0.2em]">
                Restricted console
              </span>
            </div>
            <h1 className="mt-2 font-display text-4xl font-bold">Admin Dashboard</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Manage platform activity and configuration.
            </p>
          </div>
          <div className="flex gap-1 overflow-x-auto">
            {tabs.map((item) => (
              <button
                key={item.id}
                onClick={() => setTab(item.id)}
                className={`whitespace-nowrap rounded-md px-3 py-2 text-sm ${tab === item.id ? "bg-gold text-primary-foreground" : "text-muted-foreground hover:bg-surface-2"}`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
        {tab === "overview" && (
          <Overview
            pending={pending}
            transactions={state?.transactions ?? []}
            onReview={() => setTab("transactions")}
          />
        )}
        {tab === "transactions" && (
          <Transactions transactions={state?.transactions ?? []} profiles={state?.profiles ?? []} />
        )}
        {tab === "users" && <Users users={usersQuery.data?.users ?? []} query={usersQuery} />}
        {tab === "settings" && <Settings settings={state?.settings} />}
      </main>
    </div>
  );
}
function Overview({ pending, transactions, onReview }: any) {
  return (
    <section className="mt-8">
      <div className="grid gap-4 sm:grid-cols-3">
        <Metric label="Pending review" value={pending.length} />
        <Metric label="Transactions" value={transactions.length} />
        <Metric
          label="Users represented"
          value={new Set(transactions.map((t: any) => t.user_id)).size}
        />
      </div>
      <div className="panel mt-6 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-semibold">Queue requiring attention</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Withdrawals and deposits awaiting a decision.
            </p>
          </div>
          <button
            onClick={onReview}
            className="rounded-md border border-border px-3 py-2 text-xs font-semibold hover:bg-surface-2"
          >
            Review queue
          </button>
        </div>
        {pending.length === 0 ? (
          <Empty text="No pending transactions." />
        ) : (
          <div className="mt-5 space-y-2">
            {pending.slice(0, 5).map((tx: any) => (
              <MiniTx key={tx.id} tx={tx} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="panel p-5">
      <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-3 font-display text-3xl font-bold text-gold">{value}</p>
    </div>
  );
}
function Transactions({ transactions, profiles }: any) {
  const client = useQueryClient();
  const update = useServerFn(updateAdminTransaction);
  const mutation = useMutation({
    mutationFn: update,
    onSuccess: () => client.invalidateQueries({ queryKey: ["admin-state"] }),
  });
  const profile = (id: string) => profiles.find((p: any) => p.id === id);
  return (
    <section className="panel mt-8 overflow-hidden">
      <div className="border-b border-border p-6">
        <h2 className="font-semibold">Transaction management</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Review each request once. Completed decisions are locked by the database.
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-sm">
          <thead className="bg-surface text-left text-[11px] uppercase tracking-wider text-muted-foreground">
            <tr>
              {["Created", "User", "Type", "Amount", "Status", "Action"].map((x) => (
                <th key={x} className="px-5 py-3">
                  {x}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {transactions.map((tx: any) => {
              const p = profile(tx.user_id);
              const actionable = pendingStatuses.includes(tx.status);
              return (
                <tr key={tx.id} className="border-t border-border">
                  <td className="px-5 py-4 font-mono text-xs text-muted-foreground">
                    {new Date(tx.created_at).toLocaleString()}
                  </td>
                  <td className="px-5 py-4">
                    {p?.display_name || p?.email || tx.user_id.slice(0, 8)}
                  </td>
                  <td className="px-5 py-4 capitalize">{tx.type.replace("_", " ")}</td>
                  <td className="px-5 py-4 font-mono">
                    {Number(tx.amount).toLocaleString()} {tx.asset}
                  </td>
                  <td className="px-5 py-4">
                    <Status status={tx.status} />
                  </td>
                  <td className="px-5 py-4">
                    {actionable ? (
                      <div className="flex gap-2">
                        <ActionButton
                          label="Approve"
                          onClick={() =>
                            mutation.mutate({ transactionId: tx.id, action: "approve" })
                          }
                          disabled={mutation.isPending}
                        />
                        <ActionButton
                          label="Decline"
                          danger
                          onClick={() =>
                            mutation.mutate({ transactionId: tx.id, action: "decline" })
                          }
                          disabled={mutation.isPending}
                        />
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">Locked</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {transactions.length === 0 && <Empty text="No transaction history." />}
      </div>
      {mutation.error && (
        <p className="border-t border-border p-4 text-sm text-bear">{mutation.error.message}</p>
      )}
    </section>
  );
}
function ActionButton({ label, onClick, danger, disabled }: any) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`rounded px-2.5 py-1.5 text-xs font-semibold disabled:opacity-50 ${danger ? "border border-bear/40 text-bear hover:bg-bear/10" : "bg-gold text-primary-foreground hover:brightness-110"}`}
    >
      {label}
    </button>
  );
}
function Users({ users, query }: any) {
  const client = useQueryClient();
  const remove = useServerFn(deleteAdminUser);
  const mutation = useMutation({
    mutationFn: remove,
    onSuccess: () => client.invalidateQueries({ queryKey: ["admin-users"] }),
  });
  return (
    <section className="panel mt-8 p-6">
      <h2 className="font-semibold">Users</h2>
      <p className="mt-1 text-sm text-muted-foreground">All registered platform accounts.</p>
      <div className="mt-5 divide-y divide-border">
        {query.isLoading ? (
          <p className="py-10 text-center text-sm">Loading users…</p>
        ) : (
          users.map((p: any) => (
            <div
              key={p.id}
              className="flex flex-col gap-2 py-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <span>
                <span className="font-medium">
                  {p.user_metadata?.display_name || p.email || "Unnamed user"}
                </span>
                <span className="ml-2 text-xs text-muted-foreground">{p.email}</span>
              </span>
              <button
                type="button"
                disabled={mutation.isPending}
                onClick={() => {
                  if (
                    window.confirm(
                      `Delete ${p.email || "this user"}? This permanently removes the account.`,
                    )
                  )
                    mutation.mutate({ userId: p.id });
                }}
                className="self-start rounded border border-bear/40 px-2.5 py-1.5 text-xs font-semibold text-bear hover:bg-bear/10 disabled:opacity-50 sm:self-auto"
              >
                Delete
              </button>
            </div>
          ))
        )}
      </div>
      {query.error && <p className="py-4 text-sm text-bear">{query.error.message}</p>}
      {mutation.error && <p className="py-4 text-sm text-bear">{mutation.error.message}</p>}
      {!query.isLoading && users.length === 0 && <Empty text="No users found." />}
    </section>
  );
}
function Settings({ settings }: any) {
  const client = useQueryClient();
  const update = useServerFn(updateAdminSettings);
  const [addresses, setAddresses] = useState({
    BTC: settings?.bitcoin_wallet_address ?? "",
    ETH: settings?.ethereum_wallet_address ?? "",
    SOL: settings?.solana_wallet_address ?? "",
    USDT: settings?.usdt_wallet_address ?? settings?.wallet_address ?? "",
  });
  const [min, setMin] = useState(String(settings?.min_withdrawal ?? 0));
  const [max, setMax] = useState(String(settings?.max_withdrawal ?? 1000000));
  const mutation = useMutation({
    mutationFn: update,
    onSuccess: () => client.invalidateQueries({ queryKey: ["admin-state"] }),
  });
  return (
    <section className="panel mt-8 max-w-2xl p-6">
      <h2 className="font-semibold">Platform settings</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Changes are persistent and enforced by the withdrawal service.
      </p>
      <div className="mt-6 space-y-5">
        {(["BTC", "ETH", "SOL", "USDT"] as const).map((asset) => (
          <label key={asset} className="block text-sm">
            {asset} wallet address
            <input
              value={addresses[asset]}
              onChange={(e) => setAddresses((current) => ({ ...current, [asset]: e.target.value }))}
              className="mt-2 w-full rounded-md border border-border bg-background px-3 py-2.5 font-mono text-xs outline-none focus:border-gold"
            />
          </label>
        ))}
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm">
            Minimum withdrawal
            <input
              type="number"
              min="0"
              value={min}
              onChange={(e) => setMin(e.target.value)}
              className="mt-2 w-full rounded-md border border-border bg-background px-3 py-2.5 outline-none focus:border-gold"
            />
          </label>
          <label className="block text-sm">
            Maximum withdrawal
            <input
              type="number"
              min="0"
              value={max}
              onChange={(e) => setMax(e.target.value)}
              className="mt-2 w-full rounded-md border border-border bg-background px-3 py-2.5 outline-none focus:border-gold"
            />
          </label>
        </div>
        <button
          disabled={mutation.isPending}
          onClick={() =>
            mutation.mutate({
              bitcoinWalletAddress: addresses.BTC,
              ethereumWalletAddress: addresses.ETH,
              solanaWalletAddress: addresses.SOL,
              usdtWalletAddress: addresses.USDT,
              minWithdrawal: Number(min),
              maxWithdrawal: Number(max),
            })
          }
          className="rounded-md bg-gold px-4 py-2.5 text-sm font-bold text-primary-foreground disabled:opacity-50"
        >
          {mutation.isPending ? "Saving…" : "Save settings"}
        </button>
        {mutation.isSuccess && <p className="text-sm text-bull">Settings saved and active.</p>}
        {mutation.error && <p className="text-sm text-bear">{mutation.error.message}</p>}
      </div>
    </section>
  );
}
function MiniTx({ tx }: any) {
  return (
    <div className="flex items-center justify-between rounded-md border border-border bg-background p-3">
      <span className="capitalize">
        {tx.type.replace("_", " ")}{" "}
        <span className="font-mono text-xs text-muted-foreground">{tx.asset}</span>
      </span>
      <Status status={tx.status} />
    </div>
  );
}
function Status({ status }: { status: string }) {
  const good = ["confirmed", "completed", "successful"].includes(status);
  const declined = ["cancelled", "failed"].includes(status);
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded px-2 py-1 text-xs capitalize ${good ? "bg-bull/15 text-bull" : declined ? "bg-bear/15 text-bear" : "bg-amber-500/15 text-amber-400"}`}
    >
      {good ? (
        <CheckCircle2 className="h-3 w-3" />
      ) : declined ? (
        <XCircle className="h-3 w-3" />
      ) : (
        <Clock3 className="h-3 w-3" />
      )}
      {status.replace("_", " ")}
    </span>
  );
}
function Empty({ text }: { text: string }) {
  return <p className="py-10 text-center text-sm text-muted-foreground">{text}</p>;
}
