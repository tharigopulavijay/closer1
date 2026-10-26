import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { personById } from "../../mocks/people";
import { venueById } from "../../mocks/catalog";
import { chatIsOpen, closesAt, DEPOSIT_INR } from "./api";
import { closeKindly, keepChat, payDeposit, sendMessage, setAway, clearAway, submitDebrief } from "../../state/logic";
import { useStore } from "../../state/store";
import { Button, Card, Chip, Sheet } from "../../ui/primitives";
import { Screen } from "../../ui/shell";
import { Portrait } from "../../ui/visuals";
import type { Away } from "../../lib/types";

export function PlansHome() {
  const { state } = useStore();
  const [tab, setTab] = useState<"upcoming" | "chats" | "past">("upcoming");
  const navigate = useNavigate();
  const now = Date.now();
  const upcoming = state.plans.filter((plan) => plan.status === "upcoming");
  const past = state.plans.filter((plan) => plan.status !== "upcoming");
  const chats = state.plans.filter((plan) => chatIsOpen(plan, now) || (state.messages[plan.id]?.length ?? 0) > 0);
  const list = tab === "upcoming" ? upcoming : tab === "past" ? past : chats;
  return (
    <Screen tab title="Plans">
      <div className="flex gap-2">
        {(["upcoming", "chats", "past"] as const).map((item) => (
          <Chip key={item} active={tab === item} onClick={() => setTab(item)}>
            {item[0].toUpperCase() + item.slice(1)}
          </Chip>
        ))}
      </div>
      {state.away ? (
        <button type="button" onClick={() => navigate("/away")} className="mt-4 w-full rounded-3xl border border-mint/40 bg-card p-4 text-left">
          <p className="text-sm font-semibold text-mint">Away mode is on</p>
          <p className="text-sm text-mute">Drop is paused. Streak is frozen.</p>
        </button>
      ) : null}
      <div className="mt-4 space-y-3">
        {list.length === 0 ? (
          <Card>
            <p className="font-semibold">{tab === "chats" ? "No open chats" : "Nothing here yet"}</p>
            <p className="mt-1 text-sm text-mute">Plans start when a like is mutual. You can keep three open.</p>
          </Card>
        ) : null}
        {list.map((plan) => {
          const person = personById(plan.personId);
          const venue = venueById(plan.venueId);
          return (
            <button key={plan.id} type="button" onClick={() => navigate(tab === "chats" ? `/plans/${plan.id}/chat` : `/plans/${plan.id}`)} className="flex w-full gap-3 rounded-3xl border border-line bg-card p-3 text-left">
              {person ? <Portrait name={person.name} palette={person.palette} className="h-20 w-16 rounded-2xl" /> : null}
              <span>
                <span className="block font-semibold">{person?.name ?? "Someone"}</span>
                <span className="block text-sm text-mute">{venue.name} · {plan.slot}</span>
                <span className="mt-1 block text-xs text-gold">{plan.deposit === "paid" ? "Deposit paid" : plan.deposit === "refunded" ? "Deposit returned" : "Deposit due"}</span>
              </span>
            </button>
          );
        })}
      </div>
      <button type="button" onClick={() => navigate("/away")} className="mt-6 text-sm font-semibold text-mute">
        Going away?
      </button>
    </Screen>
  );
}

export function PlanDetail() {
  const { id = "" } = useParams();
  const { state, current, commit } = useStore();
  const navigate = useNavigate();
  const plan = state.plans.find((item) => item.id === id);
  const person = plan ? personById(plan.personId) : undefined;
  const venue = plan ? venueById(plan.venueId) : undefined;
  if (!plan || !person || !venue) return <Screen title="Plan" back="/plans"><p>This plan has gone.</p></Screen>;
  const close = closesAt(plan);
  return (
    <Screen title="Plan" back="/plans">
      <Card>
        <p className="text-xs uppercase tracking-[0.16em] text-gold">Ticket</p>
        <h2 className="mt-2 font-serif text-4xl">{person.name.split(" ")[0]}</h2>
        <p className="mt-2 text-sm text-mute">{venue.name} · {venue.area}</p>
        <p className="text-sm text-mute">{plan.slot} · {plan.kind}</p>
        <p className="mt-4 text-2xl font-semibold">₹{DEPOSIT_INR}</p>
        <p className="text-sm text-mute">
          {plan.deposit === "paid"
            ? "Held for the table. It returns if you both show up."
            : "Pays the café if someone doesn't come. Preview only — no charge leaves this phone."}
        </p>
      </Card>
      {plan.status !== "upcoming" ? (
        <div className="mt-4">
          <Button onClick={() => navigate(`/plans/${plan.id}/debrief`)}>Debrief</Button>
        </div>
      ) : plan.deposit !== "paid" ? (
        <div className="mt-4">
          <Button onClick={() => commit(payDeposit(current(), plan.id))}>Pay with UPI (preview)</Button>
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          <Button onClick={() => navigate(`/plans/${plan.id}/chat`)}>Open chat</Button>
          <Button variant="ghost" onClick={() => navigate(`/safety/date/${plan.id}`)}>
            Date day
          </Button>
        </div>
      )}
      {close && plan.deposit === "paid" ? (
        <p className="mt-4 text-sm text-mute">Chat closes {new Date(close).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })} unless you both keep it.</p>
      ) : null}
      <div className="mt-4">
        <Button variant="ghost" onClick={() => { commit(closeKindly(current(), plan.id)); navigate("/plans"); }}>
          Close kindly
        </Button>
      </div>
    </Screen>
  );
}

export function PlanChat() {
  const { id = "" } = useParams();
  const { state, current, commit } = useStore();
  const [text, setText] = useState("");
  const [warning, setWarning] = useState("");
  const plan = state.plans.find((item) => item.id === id);
  const person = plan ? personById(plan.personId) : undefined;
  const open = plan ? chatIsOpen(plan, Date.now()) : false;
  const thread = state.messages[id] ?? [];
  if (!plan || !person) return <Screen title="Chat" back="/plans"><p>Chat closed.</p></Screen>;
  return (
    <Screen title={person.name.split(" ")[0]} back={`/plans/${plan.id}`}>
      {state.away ? <p className="mb-3 rounded-2xl bg-card px-3 py-2 text-sm text-mint">You're away. This chat stays quiet until you're back.</p> : null}
      {!open ? <p className="mb-3 text-sm text-mute">This chat is closed. It stays shut 48 hours after booking unless you both keep it.</p> : null}
      <div className="space-y-2">
        {thread.map((message) => (
          <p key={message.id} className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${message.from === "me" ? "ml-auto bg-gold text-ink" : message.from === "system" ? "mx-auto text-center text-mute" : "bg-card"}`}>
            {message.text}
          </p>
        ))}
      </div>
      {open ? (
        <div className="mt-4 flex gap-2">
          <input className="h-12 flex-1 rounded-2xl border border-line bg-card px-3" value={text} onChange={(event) => setText(event.target.value)} placeholder="A note" />
          <button
            type="button"
            className="h-12 rounded-2xl bg-gold px-4 font-semibold text-ink"
            onClick={() => {
              const result = sendMessage(current(), plan.id, text);
              commit(result.state);
              if (result.status === "blocked") setWarning(`Not sent. ${result.rule}. A person reviews severe reports. Nothing was delivered.`);
              else setText("");
            }}
          >
            Send
          </button>
        </div>
      ) : null}
      <div className="mt-4 grid grid-cols-2 gap-2">
        <Button variant="ghost" onClick={() => commit(keepChat(current(), plan.id))}>
          {plan.keptByMe ? "Keeping it" : "Keep chat"}
        </Button>
        <Button variant="ghost" onClick={() => commit(closeKindly(current(), plan.id))}>
          Close kindly
        </Button>
      </div>
      <Sheet open={Boolean(warning)} title="Read this first" onClose={() => setWarning("")}>
        <p className="text-sm text-mute">{warning}</p>
        <div className="mt-4"><Button onClick={() => setWarning("")}>Okay</Button></div>
      </Sheet>
    </Screen>
  );
}

export function Debrief() {
  const { id = "" } = useParams();
  const { current, commit } = useStore();
  const navigate = useNavigate();
  const [feel, setFeel] = useState("Warm");
  const [again, setAgain] = useState("Not sure");
  const [note, setNote] = useState("");
  return (
    <Screen title="Debrief" back="/plans">
      <h2 className="font-serif text-4xl">How was the <span className="italic text-gold">evening</span>?</h2>
      <p className="mt-2 text-sm text-mute">Only you can read this.</p>
      <div className="mt-4 flex flex-wrap gap-2">
        {["Calm", "Warm", "Off"].map((item) => (
          <Chip key={item} active={feel === item} onClick={() => setFeel(item)}>{item}</Chip>
        ))}
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        {["Yes", "Not sure", "No"].map((item) => (
          <Chip key={item} active={again === item} onClick={() => setAgain(item)}>{item}</Chip>
        ))}
      </div>
      <textarea className="mt-4 h-24 w-full rounded-2xl border border-line bg-card p-3" value={note} onChange={(event) => setNote(event.target.value)} placeholder="A private note" />
      <div className="mt-4">
        <Button onClick={() => { commit(submitDebrief(current(), { planId: id, feel, again, note })); navigate("/plans"); }}>
          Save debrief
        </Button>
      </div>
    </Screen>
  );
}

export function AwayScreen() {
  const { state, current, commit } = useStore();
  const [kind, setKind] = useState<Away["kind"]>(state.away?.kind ?? "busy");
  const [until, setUntil] = useState(state.away?.until ?? "");
  const navigate = useNavigate();
  return (
    <Screen title="Away" back="/plans">
      <h2 className="font-serif text-5xl leading-none">Step <span className="italic text-gold">back</span></h2>
      <p className="mt-3 text-sm text-mute">The Drop pauses. Your streak freezes instead of breaking.</p>
      <div className="mt-5 space-y-2">
        {([
          ["trip", "A trip"],
          ["busy", "A busy week"],
          ["seeing", "Seeing someone"],
        ] as const).map(([id, label]) => (
          <button key={id} type="button" onClick={() => setKind(id)} className={`w-full rounded-2xl border px-4 py-3 text-left ${kind === id ? "border-gold" : "border-line"}`}>
            {label}
          </button>
        ))}
      </div>
      {kind === "trip" ? (
        <input className="mt-4 h-12 w-full rounded-2xl border border-line bg-card px-3" type="date" value={until ?? ""} onChange={(event) => setUntil(event.target.value)} />
      ) : null}
      <div className="mt-5 space-y-3">
        <Button onClick={() => { commit(setAway(current(), { kind, until: until || null, note: "" })); navigate("/plans"); }}>
          Turn on away
        </Button>
        {state.away ? (
          <Button variant="ghost" onClick={() => { commit(clearAway(current())); navigate("/plans"); }}>
            I'm back
          </Button>
        ) : null}
      </div>
    </Screen>
  );
}
