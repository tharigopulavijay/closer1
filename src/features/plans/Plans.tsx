import { CalendarDays, ChevronRight, MapPin, Plane } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { venueById } from "../../mocks/catalog";
import { isLive } from "../../lib/env";
import type { ChatMessage } from "../../lib/types";
import { closeKindly, sendMessage } from "../../state/logic";
import { clearAway, keepChat, loadMessages, myId, openPlanChat, payDeposit, personOf, setAway, submitDebrief } from "../../state/live";
import { chatIsOpen, closesAt, DEPOSIT_INR } from "./api";
import { useStore } from "../../state/store";
import { Button, Card, Chip, Headline, Sheet } from "../../ui/primitives";
import { samplePhoto } from "../../ui/photos";
import { Screen } from "../../ui/shell";
import { Portrait } from "../../ui/visuals";
import { PLAN_KINDS, type Away } from "../../lib/types";

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
    <Screen tab>
      <Headline text="Your plans" italic="plans" />
      <p className="mt-2 text-sm text-mute">Real people. Real plans. A kinder way to meet in Hyderabad.</p>
      <div className="mt-4 flex gap-2 rounded-full border border-line bg-card p-1">
        {(["upcoming", "chats", "past"] as const).map((item) => (
          <Chip key={item} active={tab === item} onClick={() => setTab(item)} className="flex-1 border-0">
            {item[0].toUpperCase() + item.slice(1)}
          </Chip>
        ))}
      </div>
      {state.away ? (
        <button type="button" onClick={() => navigate("/away")} className="mt-4 flex min-h-11 w-full items-center gap-3 rounded-3xl border border-mint/40 bg-card p-4 text-left">
          <Plane size={18} className="text-mint" />
          <span>
            <span className="block text-sm font-semibold text-mint">Away mode is on</span>
            <span className="block text-sm text-mute">Drop is paused. Streak is frozen.</span>
          </span>
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
          const person = personOf(plan.personId);
          const venue = venueById(plan.venueId);
          return (
            <button key={plan.id} type="button" onClick={() => navigate(tab === "chats" ? `/plans/${plan.id}/chat` : `/plans/${plan.id}`)} className="flex min-h-11 w-full items-center gap-3 rounded-3xl border border-line bg-card p-3 text-left">
              {person ? (
                <Portrait
                  name={person.name}
                  palette={person.palette}
                  src={samplePhoto(state.preview, person.id)}
                  className="h-20 w-16 shrink-0 rounded-2xl"
                />
              ) : null}
              <span className="min-w-0 flex-1">
                <span className="block font-semibold">
                  {PLAN_KINDS.find((item) => item.id === plan.kind)?.label ?? "A plan"} with {person?.name.split(" ")[0] ?? "someone"}
                </span>
                <span className="mt-1 flex items-center gap-1 text-sm text-mute"><CalendarDays size={14} /> {plan.slot}</span>
                <span className="flex items-center gap-1 text-sm text-mute"><MapPin size={14} /> {venue.name}, {venue.area}</span>
                <span className={`mt-2 inline-flex min-h-9 items-center gap-1 rounded-full px-2.5 text-xs font-semibold ${plan.deposit === "paid" ? "bg-mint/15 text-mint" : plan.deposit === "refunded" ? "bg-card2 text-mute" : "bg-gold text-ink"}`}>
                  {plan.deposit === "paid" ? "Booked" : plan.deposit === "refunded" ? "Deposit returned" : "Deposit due"}
                </span>
              </span>
              <ChevronRight size={18} className="shrink-0 text-mute" />
            </button>
          );
        })}
      </div>
      {state.tableSeat ? (
        <Card className="mt-4">
          <p className="font-semibold">Table of 6</p>
          <p className="text-sm text-mute">Saturday supper · Banjara Hills · seat requested</p>
        </Card>
      ) : null}
      <button type="button" onClick={() => navigate("/away")} className="mt-6 inline-flex min-h-11 items-center text-sm font-semibold text-mute">
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
  const person = plan ? personOf(plan.personId) : undefined;
  const venue = plan ? venueById(plan.venueId) : undefined;
  if (!plan || !venue || (!person && !isLive())) return <Screen title="Plan" back="/plans"><p>This plan has gone.</p></Screen>;
  const name = person?.name.split(" ")[0] ?? "Someone";
  const close = closesAt(plan);
  return (
    <Screen back="/plans" tab>
      <Headline text={`${name}'s plan`} italic="plan" />
      <Card className="mt-4">
        <p className="text-xs uppercase tracking-[0.16em] text-gold">Ticket</p>
        <div className="mt-3 flex items-center gap-3">
          {person ? <Portrait name={person.name} palette={person.palette} src={samplePhoto(state.preview, person.id)} className="h-16 w-16 rounded-2xl" /> : null}
          <h2 className="font-serif text-4xl">{name}</h2>
        </div>
        <p className="mt-2 text-sm text-mute">{venue.name} · {venue.area}</p>
        <p className="text-sm text-mute">{plan.slot} · {plan.kind}</p>
        <p className="mt-4 text-2xl font-semibold">₹{DEPOSIT_INR}</p>
        <p className="text-sm text-mute">
          {plan.deposit === "paid"
            ? "Held for the table. It returns if you both show up."
            : isLive()
              ? "The payment desk marks this paid. This phone only shows the status."
              : "Pays the café if someone doesn't come. Preview only — no charge leaves this phone."}
        </p>
      </Card>
      {plan.status !== "upcoming" ? (
        <div className="mt-4">
          <Button onClick={() => navigate(`/plans/${plan.id}/debrief`)}>Debrief</Button>
        </div>
      ) : plan.deposit !== "paid" ? (
        <div className="mt-4">
          <Button onClick={() => void payDeposit(current(), plan.id).then((next) => commit(next))}>
            {isLive() ? `Deposit ${plan.deposit}` : "Pay with UPI (preview)"}
          </Button>
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
  const person = plan ? personOf(plan.personId) : undefined;
  const open = plan ? chatIsOpen(plan, Date.now()) : false;
  const [liveThread, setLiveThread] = useState<ChatMessage[]>([]);
  const [blocked, setBlocked] = useState("");
  const socket = useRef<ReturnType<typeof openPlanChat> | null>(null);
  useEffect(() => {
    if (!isLive() || !id) return undefined;
    let gone = false;
    void loadMessages(id)
      .then((rows) => {
        if (gone) return;
        setLiveThread(rows.map((row) => ({
          id: row.id,
          from: row.senderId === myId() ? "me" : "them",
          text: row.body,
          at: row.createdAt,
        })));
      })
      .catch((error: unknown) => setBlocked(error instanceof Error ? error.message : "Could not open chat"));
    socket.current = openPlanChat(
      id,
      (message) => {
        setLiveThread((list) => [
          ...list,
          { id: crypto.randomUUID(), from: message.from === myId() ? "me" : "them", text: message.body, at: new Date().toISOString() },
        ]);
      },
      (reason) => setBlocked(`blocked: ${reason}`),
    );
    return () => {
      gone = true;
      socket.current?.close();
    };
  }, [id]);
  const thread = isLive() ? liveThread : (state.messages[id] ?? []);
  if (!plan) return <Screen title="Chat" back="/plans"><p>Chat closed.</p></Screen>;
  return (
    <Screen title={person?.name.split(" ")[0] ?? "Chat"} back={`/plans/${plan.id}`} tab>
      {state.away ? (
        <p className="mb-3 flex items-center gap-2 rounded-2xl border border-mint/40 bg-card px-3 py-3 text-sm text-mint">
          <Plane size={16} />
          You're away{state.away.until ? ` until ${state.away.until}` : ""}. This chat stays quiet until you're back.
        </p>
      ) : null}
      {!open && !isLive() ? <p className="mb-3 text-sm text-mute">This chat is closed. It stays shut 48 hours after booking unless you both keep it.</p> : null}
      {blocked ? <p className="mb-3 text-sm text-coral">{blocked}</p> : null}
      <div className="space-y-2">
        {thread.map((message) => (
          <p key={message.id} className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${message.from === "me" ? "ml-auto bg-gold text-ink" : message.from === "system" ? "mx-auto text-center text-mute" : "bg-card"}`}>
            {message.text}
          </p>
        ))}
      </div>
      {open || isLive() ? (
        <div className="mt-4 flex gap-2">
          <input className="h-12 flex-1 rounded-2xl border border-line bg-card px-3" value={text} onChange={(event) => setText(event.target.value)} placeholder="A note" />
          <button
            type="button"
            className="h-12 min-h-11 rounded-2xl bg-gold px-4 font-semibold text-ink"
            onClick={() => {
              if (isLive()) {
                socket.current?.send(text);
                setText("");
                return;
              }
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
        <Button variant="ghost" onClick={() => void keepChat(current(), plan.id).then((next) => commit(next))}>
          {plan.keptByMe ? "Keeping it" : "Keep chat"}
        </Button>
        <Button variant="ghost" onClick={() => commit(closeKindly(current(), plan.id))}>
          Close kindly
        </Button>
      </div>
      <Sheet open={Boolean(warning)} title="Held for review" onClose={() => setWarning("")}>
        <p className="text-sm text-mute">{warning}</p>
        <p className="mt-2 text-sm text-mute">It was not delivered. A person on the safety desk reads severe reports. There is nothing else to confirm.</p>
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
    <Screen title="Debrief" back="/plans" tab>
      <Headline text="How was the evening?" italic="evening" />
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
        <Button onClick={() => { void submitDebrief(current(), { planId: id, feel, again, note }).then((next) => { commit(next); navigate("/plans"); }); }}>
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
    <Screen title="Away" back="/plans" tab>
      <Headline text="Step back" italic="back" />
      <p className="mt-3 text-sm text-mute">The Drop pauses. Your streak freezes instead of breaking.</p>
      <div className="mt-5 space-y-2">
        {([
          ["trip", "A trip"],
          ["busy", "A busy week"],
          ["seeing", "Seeing someone"],
        ] as const).map(([id, label]) => (
          <button key={id} type="button" onClick={() => setKind(id)} className={`min-h-11 w-full rounded-2xl border px-4 py-3 text-left ${kind === id ? "border-gold bg-card2" : "border-line bg-card"}`}>
            {label}
          </button>
        ))}
      </div>
      {kind === "trip" ? (
        <input className="mt-4 h-12 w-full rounded-2xl border border-line bg-card px-3" type="date" value={until ?? ""} onChange={(event) => setUntil(event.target.value)} />
      ) : null}
      <div className="mt-5 space-y-3">
        <Button onClick={() => { void setAway(current(), { kind, until: until || null, note: "" }).then((next) => { commit(next); navigate("/plans"); }); }}>
          Turn on away
        </Button>
        {state.away ? (
          <Button variant="ghost" onClick={() => { void clearAway(current()).then((next) => { commit(next); navigate("/plans"); }); }}>
            I'm back
          </Button>
        ) : null}
      </div>
    </Screen>
  );
}
