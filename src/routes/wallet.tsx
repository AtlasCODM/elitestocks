import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Header } from "@/components/site/Header";
import { Footer } from "@/components/site/Footer";
import { Ticker } from "@/components/site/Ticker";
import { ASSETS } from "@/lib/market-data";
import { useAuth } from "@/hooks/useAuth";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getWalletState } from "@/lib/wallet.functions";
import { confirmDeposit, getDepositAddress } from "@/lib/deposit.functions";
import { createWithdrawal } from "@/lib/withdraw.functions";
import { useEffect, useState } from "react";
import { ArrowDownToLine, ArrowUpFromLine, Copy, CheckCircle2, Clock, Loader2 } from "lucide-react";
import { toast } from "sonner";

type Asset = "BTC" | "ETH" | "SOL" | "USDT";

const DEPOSIT_ADDRESSES: Record<Asset, string> = {
  BTC: "bc1qaureumvault0x9k3hp2rqz8mvy7w5tnxe4ucfd2",
  ETH: "0xA8F4cBd2e9C1b7F3D6E8a25C9b14fE7d3C8B6a91",
  SOL: "Aur3umVau1tSo1ana8KqM2P7yT4hN6dF9cJpR1eB",
  USDT: "TAur3umTether8VaU1t9Kx7M2Pq4Yh5JcNd6FbR3",
};

export const Route = createFileRoute("/wallet")({
  head: () => ({
    meta: [
      { title: "Wallet — Aureum Exchange" },
      {
        name: "description",
        content: "Manage your multi-asset wallet, deposits, and withdrawals.",
      },
    ],
  }),
  component: WalletPage,
});

function WalletPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState<"overview" | "deposit" | "withdraw" | "history">("overview");

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/login" });
  }, [user, loading, navigate]);

  const fetchState = useServerFn(getWalletState);
  const { data, isLoading } = useQuery({
    queryKey: ["wallet-state"],
    queryFn: () => fetchState(),
    enabled: !!user,
    refetchInterval: 15000,
  });

  if (loading || !user) return <div className="min-h-screen bg-background" />;

  const balances: Record<Asset, number> = { BTC: 0, ETH: 0, SOL: 0, USDT: 0 };
  for (const w of data?.wallets ?? []) balances[w.asset as Asset] = Number(w.balance);

  const totalUsd =
    balances.BTC * (ASSETS.find((a) => a.symbol === "BTC")?.price ?? 0) +
    balances.ETH * (ASSETS.find((a) => a.symbol === "ETH")?.price ?? 0) +
    balances.SOL * (ASSETS.find((a) => a.symbol === "SOL")?.price ?? 0) +
    balances.USDT;

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <Ticker />
      <div className="mx-auto max-w-[1400px] px-4 py-8 lg:px-6">
        <div className="grid items-end gap-6 md:grid-cols-[1fr_auto]">
          <div>
            <h1 className="font-display text-4xl font-bold tracking-tight">Wallet</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Multi-asset custody · deposits, withdrawals, and investments
            </p>
          </div>
          <div className="rounded-lg border border-border bg-surface px-6 py-4">
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
              Total Portfolio Value
            </div>
            <div className="font-mono text-3xl font-bold text-gold gold-text-glow">
              ${totalUsd.toLocaleString(undefined, { maximumFractionDigits: 2 })}
            </div>
          </div>
        </div>

        <div className="mt-8 flex gap-1 overflow-x-auto border-b border-border">
          {(["overview", "deposit", "withdraw", "history"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`relative px-4 py-2.5 text-sm font-semibold capitalize transition-colors ${
                tab === t ? "text-gold" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {t}
              {tab === t && <div className="absolute inset-x-0 -bottom-px h-0.5 bg-gold" />}
            </button>
          ))}
        </div>

        {isLoading ? (
          <div className="mt-12 flex items-center justify-center text-sm text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading wallet…
          </div>
        ) : (
          <>
            {tab === "overview" && <Overview balances={balances} />}
            {tab === "deposit" && <Deposit />}
            {tab === "withdraw" && <Withdraw balances={balances} />}
            {tab === "history" && <History transactions={data?.transactions ?? []} />}
          </>
        )}
      </div>
      <Footer />
    </div>
  );
}

function Overview({ balances }: { balances: Record<Asset, number> }) {
  return (
    <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {ASSETS.map((a) => {
        const bal = balances[a.symbol as Asset];
        const usd = bal * a.price;
        return (
          <div key={a.symbol} className="panel relative overflow-hidden p-5">
            <div className="absolute inset-0 grid-bg-sm opacity-20" />
            <div className="relative flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div
                  className="flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold"
                  style={{ background: a.color + "20", color: a.color }}
                >
                  {a.symbol === "BTC"
                    ? "₿"
                    : a.symbol === "ETH"
                      ? "Ξ"
                      : a.symbol === "SOL"
                        ? "◎"
                        : "₮"}
                </div>
                <div>
                  <div className="font-semibold">{a.symbol}</div>
                  <div className="text-[11px] text-muted-foreground">{a.name}</div>
                </div>
              </div>
              <span className={`font-mono text-xs ${a.change24h >= 0 ? "text-bull" : "text-bear"}`}>
                {a.change24h >= 0 ? "+" : ""}
                {a.change24h.toFixed(2)}%
              </span>
            </div>
            <div className="relative mt-5">
              <div className="font-mono text-2xl font-bold">
                {bal.toLocaleString(undefined, { maximumFractionDigits: 6 })}
              </div>
              <div className="font-mono text-xs text-muted-foreground">
                ≈ ${usd.toLocaleString(undefined, { maximumFractionDigits: 2 })}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Deposit() {
  const qc = useQueryClient();
  const deposit = useServerFn(confirmDeposit);
  const fetchAddress = useServerFn(getDepositAddress);
  const [asset, setAsset] = useState<Asset>("USDT");
  const [amount, setAmount] = useState("");
  const addressQuery = useQuery({
    queryKey: ["deposit-address", asset],
    queryFn: () => fetchAddress({ data: { asset } }),
    staleTime: 0,
  });
  const depositAddress = addressQuery.data?.address ?? DEPOSIT_ADDRESSES[asset];

  const m = useMutation({
    mutationFn: (v: { asset: Asset; amount: number }) => deposit({ data: v }),
    onSuccess: () => {
      toast.success("Deposit submitted — funds will be credited in ~5 minutes");
      setAmount("");
      qc.invalidateQueries({ queryKey: ["wallet-state"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const handle = () => {
    const n = parseFloat(amount);
    if (!n || n <= 0) return toast.error("Enter a valid amount");
    m.mutate({ asset, amount: n });
  };

  return (
    <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_1fr]">
      <div className="panel p-6">
        <h2 className="font-semibold">Deposit {asset}</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Send funds to the address below, then confirm your deposit.
        </p>

        <div className="mt-5">
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
            Select Asset
          </div>
          <div className="mt-2 grid grid-cols-4 gap-2">
            {ASSETS.map((a) => (
              <button
                key={a.symbol}
                onClick={() => setAsset(a.symbol as Asset)}
                className={`rounded-md border px-3 py-2.5 text-sm font-semibold ${
                  asset === a.symbol
                    ? "border-gold bg-gold/10 text-gold gold-glow"
                    : "border-border bg-surface text-muted-foreground hover:text-foreground"
                }`}
              >
                {a.symbol}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-5">
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
            Deposit Address
          </div>
          <div className="mt-2 flex items-center gap-2 rounded-md border border-border bg-background px-3 py-3 font-mono text-xs">
            <span className="truncate">{depositAddress}</span>
            <button
              onClick={() => {
                navigator.clipboard.writeText(depositAddress);
                toast.success("Address copied");
              }}
              className="text-muted-foreground hover:text-gold"
            >
              <Copy className="h-3.5 w-3.5" />
            </button>
          </div>
          <p className="mt-1 text-[10px] text-muted-foreground">
            Send only {asset} to this address. Other assets will be lost.
          </p>
        </div>

        <div className="mt-5">
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
            Amount Sent
          </div>
          <input
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
            className="mt-2 w-full rounded-md border border-border bg-background px-3 py-3 font-mono text-lg outline-none focus:border-gold"
          />
        </div>

        <button
          onClick={handle}
          disabled={m.isPending}
          className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-md bg-gold py-3 text-sm font-bold text-primary-foreground hover:brightness-110 disabled:opacity-60"
        >
          <ArrowDownToLine className="h-4 w-4" /> {m.isPending ? "Submitting…" : "Confirm Deposit"}
        </button>
      </div>

      <div className="panel p-6">
        <h2 className="font-semibold">How deposits work</h2>
        <ol className="mt-4 space-y-3 text-sm text-muted-foreground">
          <li>
            <span className="text-foreground font-semibold">1.</span> Select the asset and enter the
            amount.
          </li>
          <li>
            <span className="text-foreground font-semibold">2.</span> Click{" "}
            <span className="text-gold">Confirm Deposit</span>.
          </li>
          <li>
            <span className="text-foreground font-semibold">3.</span> Your balance is credited
            automatically within ~5 minutes.
          </li>
        </ol>
        <div className="mt-6 rounded-md border border-border bg-surface p-4 text-xs text-muted-foreground">
          Track real-time status in the History tab.
        </div>
      </div>
    </div>
  );
}

function Withdraw({ balances }: { balances: Record<Asset, number> }) {
  const qc = useQueryClient();
  const wd = useServerFn(createWithdrawal);
  const [asset, setAsset] = useState<Asset>("USDT");
  const [amount, setAmount] = useState("");
  const [address, setAddress] = useState("");

  const m = useMutation({
    mutationFn: (v: { asset: Asset; amount: number; address: string }) => wd({ data: v }),
    onSuccess: () => {
      toast.success("Withdrawal submitted");
      setAmount("");
      setAddress("");
      qc.invalidateQueries({ queryKey: ["wallet-state"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const handle = () => {
    const n = parseFloat(amount);
    if (!n || n <= 0) return toast.error("Enter a valid amount");
    if (n > balances[asset]) return toast.error("Insufficient balance");
    if (!address || address.length < 10) return toast.error("Enter a valid destination address");
    m.mutate({ asset, amount: n, address });
  };

  return (
    <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_1fr]">
      <div className="panel p-6">
        <h2 className="font-semibold">Withdraw {asset}</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Withdrawals are processed through our backend security pipeline.
        </p>

        <div className="mt-5">
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
            Select Asset
          </div>
          <div className="mt-2 grid grid-cols-4 gap-2">
            {ASSETS.map((a) => (
              <button
                key={a.symbol}
                onClick={() => setAsset(a.symbol as Asset)}
                className={`rounded-md border px-3 py-2.5 text-sm font-semibold ${
                  asset === a.symbol
                    ? "border-gold bg-gold/10 text-gold gold-glow"
                    : "border-border bg-surface text-muted-foreground hover:text-foreground"
                }`}
              >
                {a.symbol}
              </button>
            ))}
          </div>
          <div className="mt-2 font-mono text-[11px] text-muted-foreground">
            Available: {balances[asset].toLocaleString(undefined, { maximumFractionDigits: 6 })}{" "}
            {asset}
          </div>
        </div>

        <div className="mt-5">
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
            Destination Address
          </div>
          <input
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder={`${asset} address`}
            className="mt-2 w-full rounded-md border border-border bg-background px-3 py-3 font-mono text-xs outline-none focus:border-gold"
          />
        </div>

        <div className="mt-5">
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Amount</div>
          <input
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
            className="mt-2 w-full rounded-md border border-border bg-background px-3 py-3 font-mono text-lg outline-none focus:border-gold"
          />
        </div>

        <button
          onClick={handle}
          disabled={m.isPending}
          className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-md bg-gold py-3 text-sm font-bold text-primary-foreground hover:brightness-110 disabled:opacity-60"
        >
          <ArrowUpFromLine className="h-4 w-4" />{" "}
          {m.isPending ? "Submitting…" : "Submit Withdrawal"}
        </button>
      </div>

      <div className="panel p-6">
        <h2 className="font-semibold">Withdrawal policy</h2>
        <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
          <li>• Funds are debited from your wallet immediately on submission.</li>
          <li>• Each withdrawal is reviewed by our backend processing pipeline.</li>
          <li>• You can monitor status in the History tab.</li>
          <li>• Double-check the destination address — on-chain transfers are irreversible.</li>
        </ul>
      </div>
    </div>
  );
}

type TxRow = {
  id: string;
  type: string;
  asset: string;
  amount: number | string;
  status: string;
  created_at: string;
};

function History({ transactions }: { transactions: TxRow[] }) {
  return (
    <div className="mt-6 overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-sm">
        <thead className="bg-surface text-[11px] uppercase tracking-wider text-muted-foreground">
          <tr>
            <th className="px-4 py-3 text-left">Time</th>
            <th className="px-4 py-3 text-left">Type</th>
            <th className="px-4 py-3 text-left">Asset</th>
            <th className="px-4 py-3 text-right">Amount</th>
            <th className="px-4 py-3 text-left">Status</th>
            <th className="px-4 py-3 text-left">TX ID</th>
          </tr>
        </thead>
        <tbody>
          {transactions.length === 0 && (
            <tr>
              <td colSpan={6} className="px-4 py-12 text-center text-sm text-muted-foreground">
                No transactions yet
              </td>
            </tr>
          )}
          {transactions.map((t) => (
            <tr key={t.id} className="border-t border-border bg-background">
              <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                {new Date(t.created_at).toLocaleString()}
              </td>
              <td className="px-4 py-3">
                <span className="rounded bg-gold/15 px-2 py-0.5 text-xs font-semibold capitalize text-gold">
                  {t.type.replace("_", " ")}
                </span>
              </td>
              <td className="px-4 py-3 font-semibold">{t.asset}</td>
              <td className="px-4 py-3 text-right font-mono">
                {Number(t.amount).toLocaleString(undefined, { maximumFractionDigits: 6 })}
              </td>
              <td className="px-4 py-3">
                <StatusBadge status={t.status} />
              </td>
              <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                {t.id.slice(0, 12)}…
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const success = ["successful", "confirmed", "completed", "matured"].includes(status);
  const pending = ["pending", "pending_confirmation", "verifying", "processing"].includes(status);
  if (success)
    return (
      <span className="inline-flex items-center gap-1.5 rounded bg-bull/15 px-2 py-1 text-xs text-bull">
        <CheckCircle2 className="h-3 w-3" /> {status.replace("_", " ")}
      </span>
    );
  if (pending)
    return (
      <span className="inline-flex items-center gap-1.5 rounded bg-amber-500/15 px-2 py-1 text-xs text-amber-400">
        {status === "processing" ? (
          <Loader2 className="h-3 w-3 animate-spin" />
        ) : (
          <Clock className="h-3 w-3" />
        )}
        {status.replace("_", " ")}
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1.5 rounded bg-bear/15 px-2 py-1 text-xs text-bear">
      {status}
    </span>
  );
}
