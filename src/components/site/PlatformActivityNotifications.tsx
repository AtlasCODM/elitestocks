import { useEffect, useRef } from "react";
import { ArrowDownToLine, ArrowUpFromLine, CheckCircle2, TrendingUp } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";

type ActivityKind =
  | "Deposit Confirmed"
  | "Investment Started"
  | "Investment Completed"
  | "Withdrawal Completed"
  | "Returns Credited";

type Activity = {
  kind: ActivityKind;
  name: string;
  amount: number;
  isRare: boolean;
};

const NAMES = [
  "Michael A.",
  "Sarah K.",
  "Daniel R.",
  "David M.",
  "James O.",
  "Sophia C.",
  "Nathan E.",
  "Olivia P.",
  "Alexander T.",
  "Grace W.",
  "Samuel B.",
  "Victoria N.",
];
const KINDS: ActivityKind[] = [
  "Deposit Confirmed",
  "Investment Started",
  "Investment Completed",
  "Withdrawal Completed",
  "Returns Credited",
];
const NORMAL_AMOUNTS = [
  15000, 25000, 35000, 50000, 75000, 100000, 125000, 150000, 200000, 250000, 350000,
];
const RARE_AMOUNTS = [500000, 700000, 800000, 1200000, 1500000, 1800000, 2000000, 2500000];
const MAX_NOTIFICATIONS = 4;
const FIRST_DELAY_MIN = 3 * 60 * 1000;
const FIRST_DELAY_MAX = 6 * 60 * 1000;
const NEXT_DELAY_MIN = 4 * 60 * 1000;
const NEXT_DELAY_MAX = 10 * 60 * 1000;
const COOLDOWN = 90 * 1000;

function randomInt(max: number) {
  return Math.floor(Math.random() * max);
}
function randomBetween(min: number, max: number) {
  return min + Math.floor(Math.random() * (max - min + 1));
}
function pick<T>(items: readonly T[]) {
  return items[randomInt(items.length)];
}
function makeActivity(isRare: boolean, previous: Activity | null): Activity {
  let activity: Activity;
  do {
    activity = {
      kind: pick(KINDS),
      name: pick(NAMES),
      amount: pick(isRare ? RARE_AMOUNTS : NORMAL_AMOUNTS),
      isRare,
    };
  } while (
    previous &&
    activity.kind === previous.kind &&
    activity.name === previous.name &&
    activity.amount === previous.amount
  );
  return activity;
}

function ActivityToast({ activity }: { activity: Activity }) {
  const Icon = activity.kind.includes("Deposit")
    ? ArrowDownToLine
    : activity.kind.includes("Withdrawal")
      ? ArrowUpFromLine
      : activity.kind.includes("Returns")
        ? TrendingUp
        : CheckCircle2;
  const verb =
    activity.kind === "Deposit Confirmed"
      ? "deposited"
      : activity.kind === "Withdrawal Completed"
        ? "withdrew"
        : activity.kind === "Investment Started"
          ? "invested"
          : activity.kind === "Investment Completed"
            ? "completed an investment of"
            : "received returns of";
  return (
    <div className="flex w-[min(360px,calc(100vw-2rem))] items-start gap-3 rounded-lg border border-border bg-background/95 p-3 shadow-2xl backdrop-blur-md">
      <div className="mt-0.5 rounded-full bg-gold/15 p-2 text-gold">
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0">
        <div className="text-xs font-semibold uppercase tracking-wide text-gold">
          {activity.kind}
        </div>
        <div className="mt-1 text-sm text-foreground">
          {activity.name} <span className="text-muted-foreground">{verb}</span>
        </div>
        <div className="mt-1 font-mono text-sm font-semibold text-foreground">
          ${activity.amount.toLocaleString("en-US")}
        </div>
        <div className="mt-1 text-[10px] text-muted-foreground">Just now</div>
      </div>
    </div>
  );
}

export function PlatformActivityNotifications() {
  const { user } = useAuth();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startedAt = useRef<number | null>(null);
  const last = useRef<Activity | null>(null);
  const shown = useRef(0);
  const rareShown = useRef(false);

  useEffect(() => {
    if (!user) {
      if (timer.current) clearTimeout(timer.current);
      timer.current = null;
      startedAt.current = null;
      last.current = null;
      shown.current = 0;
      rareShown.current = false;
      return;
    }

    startedAt.current = Date.now();
    const storageKey = `elite-stocks-activity:${user.id}`;
    const prior = sessionStorage.getItem(storageKey);
    if (prior) {
      try {
        const state = JSON.parse(prior) as { shown: number; rareShown: boolean; last?: Activity };
        shown.current = Math.min(state.shown || 0, MAX_NOTIFICATIONS);
        rareShown.current = Boolean(state.rareShown);
        last.current = state.last ?? null;
      } catch {
        sessionStorage.removeItem(storageKey);
      }
    }

    const schedule = (delay: number) => {
      timer.current = setTimeout(() => {
        if (shown.current >= MAX_NOTIFICATIONS) return;
        const elapsed = Date.now() - (startedAt.current ?? Date.now());
        const longSessionChance = Math.min(0.22, 0.03 + (elapsed / (2 * 60 * 60 * 1000)) * 0.19);
        const rare =
          !rareShown.current && elapsed > 20 * 60 * 1000 && Math.random() < longSessionChance;
        const activity = makeActivity(rare, last.current);
        if (activity.isRare) rareShown.current = true;
        last.current = activity;
        shown.current += 1;
        sessionStorage.setItem(
          storageKey,
          JSON.stringify({ shown: shown.current, rareShown: rareShown.current, last: activity }),
        );
        toast.custom(() => <ActivityToast activity={activity} />, {
          duration: 6500,
          position: "bottom-right",
        });
        if (shown.current < MAX_NOTIFICATIONS)
          schedule(randomBetween(NEXT_DELAY_MIN + COOLDOWN, NEXT_DELAY_MAX + COOLDOWN));
      }, delay);
    };

    if (shown.current < MAX_NOTIFICATIONS) {
      schedule(
        prior
          ? randomBetween(NEXT_DELAY_MIN, NEXT_DELAY_MAX)
          : randomBetween(FIRST_DELAY_MIN, FIRST_DELAY_MAX),
      );
    }
    return () => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = null;
    };
  }, [user]);

  return null;
}
