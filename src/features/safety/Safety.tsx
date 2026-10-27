import { ChevronRight, Phone, Shield, Users } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { isLive } from "../../lib/env";
import { personOf } from "../../state/live";
import { venueById } from "../../mocks/catalog";
import { SEVERE_CATEGORIES } from "../../lib/types";
import {
  answerCheck,
  appealStrike,
  checkIn,
  confirmTrusted,
  markCheckCall,
  setCheckInterval,
  setSharing,
} from "../../state/logic";
import { addTrusted, fileReport, triggerSos } from "../../state/live";

type Coords = { lat: number | null; lng: number | null };

function phoneLocation(fallback: Coords): Promise<Coords> {
  return new Promise((resolve) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) return resolve(fallback);
    const timer = setTimeout(() => resolve(fallback), 6000);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        clearTimeout(timer);
        resolve({ lat: position.coords.latitude, lng: position.coords.longitude });
      },
      () => {
        clearTimeout(timer);
        resolve(fallback);
      },
      { enableHighAccuracy: true, timeout: 5000, maximumAge: 30000 },
    );
  });
}
import { useStore } from "../../state/store";
import { Button, Card, Chip, Headline, inputClass } from "../../ui/primitives";
import { Screen } from "../../ui/shell";
import { CityMark, MapCard } from "../../ui/visuals";
import { escalationStage, placeCheckCall, withinGeofence } from "./api";

export function SafetyHome() {
  const { state } = useStore();
  const navigate = useNavigate();
  return (
    <Screen title="Safety" back="/drop">
      <Headline text="A calm net" italic="net" />
      <p className="mt-3 text-sm text-mute">Trusted people, a check-in, and a way to reach 112. The city stays in the background.</p>
      <Card className="mt-5">
        <p className="flex items-center gap-2 font-semibold"><Users size={16} className="text-mint" /> {state.trusted.filter((item) => item.confirmed).length} of {state.trusted.length} contacts confirmed</p>
        <p className="mt-1 text-sm text-mute">Check-in every {state.checkInterval} minutes</p>
      </Card>
      <div className="mt-4 space-y-2">
        {([
          ["/safety/setup", "Trusted contacts", "They confirm before an alert can reach them"],
          ["/safety/report", "Report someone", "A person reads it. Strikes are not automatic"],
          ["/safety/strike", "Strike notice", "Appeals go to the safety desk"],
        ] as const).map(([path, label, hint]) => (
          <button key={path} type="button" onClick={() => navigate(path)} className="flex min-h-11 w-full items-center gap-3 rounded-3xl border border-line bg-card px-4 py-3 text-left">
            <span className="min-w-0 flex-1">
              <span className="block font-semibold">{label}</span>
              <span className="block text-sm text-mute">{hint}</span>
            </span>
            <ChevronRight size={18} className="text-mute" />
          </button>
        ))}
      </div>
    </Screen>
  );
}

export function SafetySetup() {
  const { state, current, commit } = useStore();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  return (
    <Screen title="Trusted people" back="/safety">
      <Headline text="Who should we call?" italic="call" />
      <p className="mt-3 text-sm text-mute">Up to five. They confirm from an SMS link before they can be alerted.</p>
      <div className="mt-4 flex gap-2">
        {([30, 60, 90] as const).map((minutes) => (
          <Chip key={minutes} active={state.checkInterval === minutes} onClick={() => commit(setCheckInterval(current(), minutes))}>
            {minutes} min
          </Chip>
        ))}
      </div>
      <div className="mt-4 space-y-3">
        {state.trusted.map((contact) => (
          <Card key={contact.id}>
            <p className="font-semibold">{contact.name}</p>
            <p className="text-sm text-mute">····{contact.phone.replace(/\D/g, "").slice(-4)}</p>
            <p className="text-sm text-mute">{contact.confirmed ? "Confirmed" : "Waiting for their yes"}</p>
            {contact.confirmed || isLive() ? null : (
              <button type="button" className="mt-2 inline-flex min-h-11 items-center text-sm font-semibold text-gold" onClick={() => commit(confirmTrusted(current(), contact.id))}>
                Mark confirmed (preview)
              </button>
            )}
          </Card>
        ))}
      </div>
      {state.trusted.length < 5 ? (
        <div className="mt-4 space-y-3">
          <input className={inputClass} placeholder="Name" value={name} onChange={(event) => setName(event.target.value)} />
          <input className={inputClass} placeholder="Mobile" value={phone} onChange={(event) => setPhone(event.target.value)} />
          <Button
            disabled={!name.trim() || phone.replace(/\D/g, "").length < 10}
            onClick={() => {
              void addTrusted(current(), name.trim(), phone).then((next) => {
                commit(next);
                setName("");
                setPhone("");
              });
            }}
          >
            Send confirmation link
          </Button>
        </div>
      ) : null}
    </Screen>
  );
}

export function DateDay() {
  const { planId = "" } = useParams();
  const { state, current, commit } = useStore();
  const navigate = useNavigate();
  const plan = state.plans.find((item) => item.id === planId);
  const person = plan ? personOf(plan.personId) : undefined;
  const venue = plan ? venueById(plan.venueId) : undefined;
  const session = state.sessions.find((item) => item.planId === planId);
  const [simulate, setSimulate] = useState(false);
  const [hold, setHold] = useState(0);
  const [sosNote, setSosNote] = useState("");
  const frame = useRef<number | null>(null);
  const now = Date.now();
  const stage = session?.promptAt
    ? escalationStage(now - Date.parse(session.promptAt), Boolean(session.answeredAt), session.helpRequested)
    : null;

  useEffect(() => {
    if (stage === "calling" && session && !session.callPlaced) {
      placeCheckCall();
      commit(markCheckCall(current(), planId));
    }
  }, [stage, session, commit, current, planId]);

  if (!plan || !person || !venue) return <Screen title="Date day" back="/plans"><p>No date is booked.</p></Screen>;

  function startHold() {
    const began = performance.now();
    const step = (time: number) => {
      const value = Math.min(1, (time - began) / 2000);
      setHold(value);
      if (value >= 1) {
        const fallback = { lat: venue?.lat ?? null, lng: venue?.lng ?? null };
        const link = document.createElement("a");
        link.href = "tel:112";
        link.click();
        // Where the phone is, not where the date was booked; the venue only if the phone won't say.
        void phoneLocation(fallback)
          .then((coords) => triggerSos(current(), planId, coords))
          .then((next) => commit(next));
        setSosNote("112 is opening. Trusted contacts and the safety desk get the location when the phone allows it.");
        return;
      }
      frame.current = requestAnimationFrame(step);
    };
    frame.current = requestAnimationFrame(step);
  }

  function cancelHold() {
    if (frame.current) cancelAnimationFrame(frame.current);
    setHold(0);
  }

  return (
    <Screen title="Date day" back={`/plans/${plan.id}`} tab>
      <div className="relative mb-4 overflow-hidden rounded-[28px] border border-line bg-card">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_70%_20%,rgba(159,215,199,0.18),transparent_42%),linear-gradient(180deg,#241830,#160E1F)]" />
        <CityMark className="absolute right-3 top-3 h-14 w-20 text-mint/80" />
        <div className="relative px-4 pb-4 pt-16">
          <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-mint"><Shield size={14} /> Calm check-in</p>
          <h2 className="mt-2 font-serif text-4xl leading-none">{person.name.split(" ")[0]} at <span className="italic text-gold">{venue.name}</span></h2>
        </div>
      </div>
      <div>
        <MapCard name={venue.name} area={venue.area} />
      </div>
      <div className="mt-4 space-y-3">
        <Button
          onClick={() => {
            const here = { lat: venue.lat, lng: venue.lng };
            const far = { lat: venue.lat + 0.02, lng: venue.lng + 0.02 };
            const coords = simulate ? here : far;
            if (!simulate && !withinGeofence(coords, venue)) {
              setSosNote("You're not within 150m of the venue yet, so check-in didn't count.");
              return;
            }
            commit(checkIn(current(), plan.id, simulate ? here : coords));
            navigate(`/safety/checkin/${plan.id}`);
          }}
        >
          I'm here
        </Button>
        <button type="button" className="min-h-11 text-left text-sm text-mute" onClick={() => setSimulate((value) => !value)}>
          {simulate ? "Preview location: at the venue" : "Use a real fix. Preview can simulate the venue pin."}
        </button>
        <Button
          variant="ghost"
          onClick={() => commit(setSharing(current(), plan.id, !(session?.sharing ?? false)))}
        >
          {session?.sharing ? "Stop sharing location" : "Share live location"}
        </Button>
        {state.trusted.find((item) => item.confirmed) ? (
          <a className="flex h-14 min-h-11 items-center justify-center gap-2 rounded-2xl border border-line font-semibold" href={`tel:${state.trusted.find((item) => item.confirmed)?.phone}`}>
            <Phone size={18} /> Call a trusted contact
          </a>
        ) : (
          <p className="text-sm text-mute">Add a confirmed contact before the rescue call can dial.</p>
        )}
      </div>
      {stage ? <p className="mt-4 text-sm text-mint">Check-in ladder: {stage}</p> : null}
      <button
        type="button"
        onPointerDown={startHold}
        onPointerUp={cancelHold}
        onPointerLeave={cancelHold}
        className="relative mt-6 flex h-16 min-h-11 w-full items-center justify-center gap-2 overflow-hidden rounded-2xl bg-coral font-semibold text-ink"
      >
        <span className="absolute inset-y-0 left-0 bg-ink/20" style={{ width: `${hold * 100}%` }} />
        <Shield size={18} className="relative" />
        <span className="relative">Hold 2 seconds for SOS</span>
      </button>
      {sosNote ? <p className="mt-3 text-sm text-cream">{sosNote}</p> : null}
    </Screen>
  );
}

export function CheckInPrompt() {
  const { planId = "" } = useParams();
  const { current, commit } = useStore();
  const navigate = useNavigate();
  return (
    <Screen title="Check-in" back={`/safety/date/${planId}`} tab>
      <Headline text="Everything okay?" italic="okay" />
      <p className="mt-3 text-sm text-mute">No answer for 5 minutes places an automated call, then alerts your contacts and the safety desk.</p>
      <div className="mt-6 space-y-3">
        <Button onClick={() => { commit(answerCheck(current(), planId, true)); navigate(`/safety/date/${planId}`); }}>
          I'm okay
        </Button>
        <Button variant="danger" onClick={() => { commit(answerCheck(current(), planId, false)); navigate(`/safety/date/${planId}`); }}>
          I need help
        </Button>
      </div>
    </Screen>
  );
}

export function ReportFlow() {
  const { state, current, commit } = useStore();
  const [name, setName] = useState("");
  const [category, setCategory] = useState(SEVERE_CATEGORIES[0]);
  const [detail, setDetail] = useState("");
  const [done, setDone] = useState(false);
  const people = state.matches.map((id) => personOf(id)?.name).filter(Boolean) as string[];
  return (
    <Screen title="Report" back="/safety">
      <Headline text="Tell us what happened" italic="happened" />
      <p className="mt-2 text-sm text-mute">Names stay on this form. A person reads every report.</p>
      {done ? (
        <Card>
          <p className="font-semibold">A person reads this.</p>
          <p className="mt-2 text-sm text-mute">Strikes are not automatic. Severe categories can become a ban only after a safety admin confirms them.</p>
        </Card>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {[...people, "Someone else"].map((item) => (
              <Chip key={item} active={name === item} onClick={() => setName(item)}>{item}</Chip>
            ))}
          </div>
          <input className={inputClass} placeholder="Name" value={name} onChange={(event) => setName(event.target.value)} />
          <div className="flex flex-wrap gap-2">
            {[...SEVERE_CATEGORIES, "Spam", "Rude"].map((item) => (
              <Chip key={item} active={category === item} onClick={() => setCategory(item)}>{item}</Chip>
            ))}
          </div>
          <textarea className="h-28 w-full rounded-2xl border border-line bg-card p-3" value={detail} onChange={(event) => setDetail(event.target.value)} placeholder="What happened" />
          <Button
            disabled={!name.trim() || !detail.trim()}
            onClick={() => {
              void fileReport(current(), {
                againstName: name.trim(),
                category,
                severe: SEVERE_CATEGORIES.includes(category),
                detail: detail.trim(),
              }).then((next) => {
                commit(next);
                setDone(true);
              });
            }}
          >
            Submit report
          </Button>
        </div>
      )}
    </Screen>
  );
}

export function StrikeNotice() {
  const { state, current, commit } = useStore();
  const [appeal, setAppeal] = useState("");
  const strike = state.myStrikes[0];
  return (
    <Screen title="Strike notice" back="/safety">
      {strike ? (
        <div className="space-y-4">
          <Headline text="A strike was confirmed" italic="confirmed" />
          <p className="text-sm text-mute">{strike.category} · {new Date(strike.at).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata" })}</p>
          <textarea className="h-28 w-full rounded-2xl border border-line bg-card p-3" value={appeal} onChange={(event) => setAppeal(event.target.value)} placeholder="Your appeal" />
          <Button onClick={() => commit(appealStrike(current(), strike.id, appeal))}>Send appeal</Button>
        </div>
      ) : (
        <Card>
          <Headline text="No strike on this account" italic="strike" />
          <p className="mt-2 text-sm text-mute">If one is confirmed by the safety desk, it shows here with a way to appeal. Three minor strikes, or one severe confirmation, closes the account.</p>
        </Card>
      )}
    </Screen>
  );
}
