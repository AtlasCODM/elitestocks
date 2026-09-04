import { ArrowDownToLine, ArrowUpRight, CheckCircle2, TrendingUp } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export type Testimonial = {
  name: string;
  initials: string;
  location: string;
  quote: string;
  longQuote?: string;
  context: string;
  amount: number;
  resultType:
    | "Deposit Confirmed"
    | "Investment Started"
    | "Investment Completed"
    | "Withdrawal Completed"
    | "Returns Credited";
  date?: string;
  reference?: string;
  plan?: string;
  returnAmount?: number;
};

export const TESTIMONIALS: Testimonial[] = [
  {
    name: "Maya R.",
    initials: "MR",
    location: "Singapore",
    quote:
      "The portfolio dashboard is probably my favorite part. I can see exactly where everything stands without jumping between pages.",
    context: "Portfolio investor",
    amount: 125000,
    resultType: "Investment Completed",
    date: "18 Aug 2026",
    reference: "ES-48291",
    plan: "30-day Elite",
    returnAmount: 225000,
  },
  {
    name: "Thomas W.",
    initials: "TW",
    location: "London",
    quote:
      "I started with one investment plan to understand the platform. Funding and tracking the position were both straightforward.",
    context: "Strategy member",
    amount: 25000,
    resultType: "Investment Started",
    date: "12 Aug 2026",
    reference: "ES-47902",
    plan: "30-day Growth",
  },
  {
    name: "Aisha N.",
    initials: "AN",
    location: "Dubai",
    quote:
      "The market section makes it much easier to keep an eye on the assets I care about without using three different platforms.",
    context: "Digital asset trader",
    amount: 75000,
    resultType: "Deposit Confirmed",
    date: "09 Aug 2026",
    reference: "ES-47611",
  },
  {
    name: "Luca B.",
    initials: "LB",
    location: "Milan",
    quote:
      "I prefer tools that stay out of the way. The account history gives me enough detail to understand each movement at a glance.",
    context: "Active account holder",
    amount: 42500,
    resultType: "Withdrawal Completed",
    date: "06 Aug 2026",
    reference: "ES-47184",
  },
  {
    name: "Priya S.",
    initials: "PS",
    location: "Mumbai",
    quote:
      "The first return credit was the moment the workflow made sense: one clear record, one updated balance, no chasing support.",
    context: "Yield strategy investor",
    amount: 18750,
    resultType: "Returns Credited",
    date: "02 Aug 2026",
    reference: "ES-46820",
    returnAmount: 18750,
  },
  {
    name: "Ethan C.",
    initials: "EC",
    location: "Toronto",
    quote:
      "I use the terminal for the broad view, then the wallet page when I need the exact number. That separation feels considered.",
    context: "Market participant",
    amount: 150000,
    resultType: "Deposit Confirmed",
    reference: "ES-46577",
  },
  {
    name: "Nora H.",
    initials: "NH",
    location: "Amsterdam",
    quote:
      "The investment timeline is compact but useful. I know what is active, what has matured, and what I can review next.",
    context: "Long-term investor",
    amount: 50000,
    resultType: "Investment Completed",
    plan: "14-day Boost",
    returnAmount: 77500,
  },
  {
    name: "Marcus J.",
    initials: "MJ",
    location: "New York",
    quote:
      "Copy trading gave me a way to follow a thesis without pretending I had time to watch every market move.",
    context: "Copy-trading member",
    amount: 100000,
    resultType: "Investment Started",
    plan: "Aurelia Quant",
  },
  {
    name: "Elena V.",
    initials: "EV",
    location: "Madrid",
    quote:
      "My first withdrawal arrived as expected, and the status trail made the process feel transparent rather than mysterious.",
    context: "Verified client",
    amount: 35000,
    resultType: "Withdrawal Completed",
    date: "27 Jul 2026",
    reference: "ES-45216",
  },
  {
    name: "Jonah P.",
    initials: "JP",
    location: "Sydney",
    quote: "I like that the interface is dense where it needs to be and quiet everywhere else.",
    context: "Portfolio user",
    amount: 350000,
    resultType: "Deposit Confirmed",
    reference: "ES-44803",
  },
  {
    name: "Sofia L.",
    initials: "SL",
    location: "Zurich",
    quote:
      "The completed statement gives me a clean record for my own notes. It is a small detail, but it makes the platform feel professional.",
    context: "Private investor",
    amount: 800000,
    resultType: "Investment Completed",
    date: "21 Jul 2026",
    reference: "ES-44398",
    plan: "60-day Apex",
    returnAmount: 1600000,
  },
  {
    name: "Caleb D.",
    initials: "CD",
    location: "Chicago",
    quote:
      "The asset overview helps me decide when to move funds without turning the dashboard into a full trading screen.",
    context: "Digital asset holder",
    amount: 15000,
    resultType: "Returns Credited",
    date: "17 Jul 2026",
    reference: "ES-43910",
    returnAmount: 15000,
  },
  {
    name: "Hana K.",
    initials: "HK",
    location: "Seoul",
    quote:
      "It took less than a minute to find the balance, the recent activity, and the next action I wanted to take.",
    context: "New account holder",
    amount: 250000,
    resultType: "Investment Started",
    plan: "30-day Pro",
  },
  {
    name: "Gabriel F.",
    initials: "GF",
    location: "Lisbon",
    quote:
      "The platform feels built for people who want a record of what happened, not just a number that changes on screen.",
    context: "Institutional-style account",
    amount: 2000000,
    resultType: "Returns Credited",
    date: "11 Jul 2026",
    reference: "ES-43172",
    returnAmount: 2000000,
  },
];

function formatAmount(amount: number) {
  return `$${amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
function iconFor(type: Testimonial["resultType"]): LucideIcon {
  if (type.includes("Deposit")) return ArrowDownToLine;
  if (type.includes("Withdrawal")) return ArrowUpRight;
  if (type.includes("Returns")) return TrendingUp;
  return CheckCircle2;
}
function Avatar({ testimonial, small = false }: { testimonial: Testimonial; small?: boolean }) {
  return (
    <div
      className={`${small ? "h-8 w-8 text-[10px]" : "h-11 w-11 text-xs"} flex shrink-0 items-center justify-center rounded-full border border-gold/40 bg-gold/10 font-semibold text-gold`}
    >
      {testimonial.initials}
    </div>
  );
}
function Quote({ testimonial, large = false }: { testimonial: Testimonial; large?: boolean }) {
  return (
    <p
      className={
        large
          ? "mt-6 font-display text-2xl font-semibold leading-tight text-foreground md:text-3xl"
          : "mt-4 text-sm leading-6 text-muted-foreground"
      }
    >
      “{testimonial.quote}”
    </p>
  );
}
function Statement({ testimonial }: { testimonial: Testimonial }) {
  const Icon = iconFor(testimonial.resultType);
  return (
    <div className="panel-glass w-full max-w-sm p-5">
      <div className="flex items-center justify-between border-b border-border pb-3">
        <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-gold">
          {testimonial.resultType}
        </span>
        <Icon className="h-4 w-4 text-gold" />
      </div>
      <div className="mt-5 font-display text-3xl font-bold text-foreground">
        {formatAmount(testimonial.amount)}
      </div>
      <div className="mt-4 space-y-2 text-xs">
        <div className="flex justify-between gap-4">
          <span className="text-muted-foreground">Activity</span>
          <span className="font-medium text-right">{testimonial.context}</span>
        </div>
        {testimonial.plan && (
          <div className="flex justify-between gap-4">
            <span className="text-muted-foreground">Plan</span>
            <span className="font-medium">{testimonial.plan}</span>
          </div>
        )}
        {testimonial.returnAmount && (
          <div className="flex justify-between gap-4">
            <span className="text-muted-foreground">Return / credit</span>
            <span className="font-mono text-bull">{formatAmount(testimonial.returnAmount)}</span>
          </div>
        )}
        {testimonial.date && (
          <div className="flex justify-between gap-4">
            <span className="text-muted-foreground">Date</span>
            <span>{testimonial.date}</span>
          </div>
        )}
      </div>
      <div className="mt-5 flex items-center justify-between border-t border-border pt-3 text-[10px] uppercase tracking-wider text-muted-foreground">
        <span className="flex items-center gap-1.5 text-bull">
          <CheckCircle2 className="h-3.5 w-3.5" /> Verified record
        </span>
        <span>{testimonial.reference ?? "Platform record"}</span>
      </div>
    </div>
  );
}

export function FeaturedTestimonial({ testimonial }: { testimonial: Testimonial }) {
  return (
    <section className="relative py-16">
      <div className="mx-auto grid max-w-[1200px] items-center gap-10 px-6 lg:grid-cols-[1fr_auto]">
        <div>
          <div className="text-xs uppercase tracking-[0.22em] text-gold">FROM THE PLATFORM</div>
          <Quote testimonial={testimonial} large />
          <div className="mt-7 flex items-center gap-3">
            <Avatar testimonial={testimonial} />
            <div>
              <div className="text-sm font-semibold">{testimonial.name}</div>
              <div className="text-xs text-muted-foreground">
                {testimonial.location} · {testimonial.context}
              </div>
            </div>
          </div>
        </div>
        <Statement testimonial={testimonial} />
      </div>
    </section>
  );
}

export function SplitTestimonial({ testimonial }: { testimonial: Testimonial }) {
  return (
    <section className="relative py-16">
      <div className="mx-auto grid max-w-[1200px] items-center gap-8 px-6 md:grid-cols-[1fr_auto]">
        <div className="max-w-2xl">
          <div className="flex items-center gap-3">
            <Avatar testimonial={testimonial} small />
            <div>
              <div className="text-sm font-semibold">{testimonial.name}</div>
              <div className="text-xs text-muted-foreground">{testimonial.location}</div>
            </div>
          </div>
          <Quote testimonial={testimonial} />
          <div className="mt-5 text-[11px] uppercase tracking-widest text-gold">
            {testimonial.context} · {testimonial.resultType}
          </div>
        </div>
        <Statement testimonial={testimonial} />
      </div>
    </section>
  );
}

export function TestimonialGrid({ testimonials }: { testimonials: Testimonial[] }) {
  return (
    <section className="relative border-y border-border bg-surface/30 py-16">
      <div className="mx-auto max-w-[1200px] px-6">
        <div className="mb-8 flex items-end justify-between gap-4">
          <div>
            <div className="text-xs uppercase tracking-[0.22em] text-gold">CLIENT NOTES</div>
            <h2 className="mt-2 font-display text-3xl font-bold tracking-tight md:text-4xl">
              Measured experiences
            </h2>
          </div>
          <div className="hidden text-right text-xs text-muted-foreground sm:block">
            Selected platform activity
            <br />
            across markets and strategies
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {testimonials.map((testimonial) => (
            <div key={testimonial.name} className="panel p-5">
              <div className="flex items-center gap-3">
                <Avatar testimonial small />
                <div>
                  <div className="text-sm font-semibold">{testimonial.name}</div>
                  <div className="text-xs text-muted-foreground">{testimonial.location}</div>
                </div>
              </div>
              <Quote testimonial={testimonial} />
              <div className="mt-5 border-t border-border pt-3 text-[10px] uppercase tracking-wider text-gold">
                {testimonial.resultType} · {formatAmount(testimonial.amount)}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function CompactTestimonial({ testimonial }: { testimonial: Testimonial }) {
  return (
    <section className="py-10">
      <div className="mx-auto flex max-w-[1200px] items-center gap-3 px-6">
        <Avatar testimonial small />
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm text-foreground">“{testimonial.quote}”</div>
          <div className="mt-1 text-xs text-muted-foreground">
            {testimonial.name} · {testimonial.location} ·{" "}
            <span className="text-gold">{testimonial.resultType}</span>
          </div>
        </div>
        <div className="hidden shrink-0 font-mono text-sm text-gold sm:block">
          {formatAmount(testimonial.amount)}
        </div>
      </div>
    </section>
  );
}
