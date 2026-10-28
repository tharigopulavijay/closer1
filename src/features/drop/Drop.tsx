import { Briefcase, Check, ChevronRight, Clock, Heart, MapPin, Snowflake, Sun } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { PEOPLE } from "../../mocks/people";
import { isLive } from "../../lib/env";
import { blockPerson, bookPlan, dropPeople, faceOf, likePerson, openDrop, personOf } from "../../state/live";
import { VENUES } from "../../mocks/catalog";
import { currentDropDate, nextDropAt } from "../../lib/time";
import { MILESTONES, PLAN_KINDS, type PlanKind } from "../../lib/types";
import { freezeStreak, joinTable, skipPerson } from "../../state/logic";
import { useStore } from "../../state/store";
import { Button, Card, Chip, Headline, VerifiedPill, inputClass } from "../../ui/primitives";
import { Screen } from "../../ui/shell";
import { SELF_PHOTOS, samplePhoto } from "../../ui/photos";
import { CityMark, Portrait } from "../../ui/visuals";
import { selectDrop, type Prefs } from "./api";

function useNow() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  return now;
}

function prefsOf(state: ReturnType<typeof useStore>["state"]): Prefs {
  const { draft } = state;
  return {
    intent: draft.intent || "both",
    showMe: draft.showMe || "everyone",
    gender: draft.gender,
    areas: draft.areas,
    languages: draft.languages,
    ageMin: draft.ageMin,
    ageMax: draft.ageMax,
    foods: draft.foods,
    interests: draft.interests,
  };
}

function clock(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function photoSrc(preview: boolean, id: string) {
  return faceOf(id) ?? samplePhoto(preview, id);
}

function roleLine(bio: string) {
  const line = bio.split(".")[0]?.trim();
  return line || bio;
}

export function DropHome() {
  const now = useNow();
  const navigate = useNavigate();
  const { state, current, commit } = useStore();
  useEffect(() => {
    void openDrop(current(), new Date()).then((next) => commit(next));
  }, [commit, current]);
  const picks = useMemo(
    () =>
      (isLive()
        ? dropPeople()
        : selectDrop(PEOPLE, prefsOf(state), currentDropDate(now), {
        viewerHash: state.draft.phoneHash,
        blocked: state.blocks,
        banned: [],
        now,
        away: Boolean(state.away),
        paused: state.paused,
      })).filter((person) => !state.skips.includes(person.id) && !state.likes.some((like) => like.personId === person.id)),
    [now, state],
  );
  const remain = clock(nextDropAt(now).getTime() - now.getTime());
  return (
    <Screen tab bleed>
      <div className="px-4 pb-8">
        <div className="relative overflow-hidden rounded-[28px] border border-line bg-card">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_80%_20%,rgba(255,181,71,0.18),transparent_42%),linear-gradient(160deg,#241830,#160E1F_70%)]" />
          <CityMark className="absolute right-3 top-3 h-16 w-24 text-gold/80" />
          <div className="relative px-4 pb-4 pt-4">
            <button
              type="button"
              onClick={() => navigate("/streak")}
              className="inline-flex min-h-11 items-center gap-2 rounded-full bg-gold px-3 text-sm font-bold text-ink"
            >
              <Sun size={16} aria-hidden />
              {state.streak.count}-day streak
            </button>
            <p className="mt-4 text-[11px] font-semibold uppercase tracking-[0.16em] text-mute">
              {new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "Asia/Kolkata" }).format(now)} · 9:00 pm
            </p>
            <Headline text="Tonight's drop" italic="drop" className="mt-1 !text-[44px]" />
            <p className="mt-2 flex items-start gap-2 text-sm text-mute">
              <Clock size={16} className="mt-0.5 shrink-0" />
              <span>
                Three people, picked for you.
                <br />
                Next Drop in {remain}
              </span>
            </p>
          </div>
        </div>
        {state.away ? (
          <Card className="mt-4">
            <p className="font-semibold">Away is on</p>
            <p className="mt-1 text-sm text-mute">The Drop is paused and your streak is frozen.</p>
            <button type="button" className="mt-3 min-h-11 text-sm font-semibold text-gold" onClick={() => navigate("/away")}>
              Change away
            </button>
          </Card>
        ) : null}
        {state.paused ? <p className="mt-4 text-sm text-mute">Your profile is paused. No one new will see you.</p> : null}
        <div className="mt-4 space-y-3">
          {picks.map((person) => {
            const shared = person.interests.filter((item) => state.draft.interests.includes(item));
            return (
              <button
                key={person.id}
                type="button"
                onClick={() => navigate(`/person/${person.id}`)}
                className="flex min-h-11 w-full items-center gap-3 rounded-[22px] border border-line bg-card p-3.5 text-left"
              >
                <Portrait
                  name={person.name}
                  palette={person.palette}
                  src={photoSrc(state.preview, person.id)}
                  compact
                  className="h-20 w-20 shrink-0 rounded-2xl"
                />
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="font-serif text-xl leading-none">
                      {person.name.split(" ")[0]}, {person.age}
                    </span>
                    {person.vouches > 0 ? (
                      <span className="rounded-full bg-mint/15 px-2 py-0.5 text-[11px] font-semibold text-mint">Vouched</span>
                    ) : (
                      <VerifiedPill />
                    )}
                  </span>
                  <span className="mt-1.5 block space-y-0.5 text-xs text-mute">
                    <span className="flex items-center gap-1.5">
                      <Briefcase size={13} /> {roleLine(person.bio)}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <MapPin size={13} /> {person.area}
                    </span>
                    {shared.length > 0 ? (
                      <span className="flex items-center gap-1.5 text-cream/90">
                        <Heart size={13} className="text-lilac" />
                        <span className="truncate">
                          You both: <span className="text-lilac">{shared.slice(0, 2).join(", ")}</span>
                        </span>
                      </span>
                    ) : null}
                  </span>
                </span>
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-line bg-card2 text-cream">
                  <ChevronRight size={16} />
                </span>
              </button>
            );
          })}
          {picks.length === 0 && !state.away ? (
            <Card>
              <p className="font-semibold">No one new with these preferences.</p>
              <p className="mt-1 text-sm text-mute">Widen an area or an age range. We won't invent people to fill the three.</p>
            </Card>
          ) : null}
        </div>
        {/* Tables of 6 are not booked by the server yet, so the live app does not offer a seat. */}
        {isLive() ? null : <button
          type="button"
          disabled={state.tableSeat}
          onClick={() => commit(joinTable(current()))}
          className="mt-4 flex min-h-14 w-full items-center gap-3 rounded-[22px] bg-gold px-3 py-3 text-left text-ink disabled:opacity-70"
        >
          <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-ink/15 font-serif text-lg">6</span>
          <span className="min-w-0 flex-1">
            <span className="block font-bold">{state.tableSeat ? "Seat requested" : "Table of 6 · Saturday supper"}</span>
            <span className="mt-0.5 block text-sm">Banjara Hills · 8:30 pm</span>
          </span>
          <span className="grid h-11 w-11 place-items-center rounded-full bg-ink text-gold">
            <ChevronRight size={16} />
          </span>
        </button>}
      </div>
    </Screen>
  );
}

export function Profile() {
  const { id = "" } = useParams();
  const { state, current, commit } = useStore();
  const person = personOf(id);
  const navigate = useNavigate();
  const [picked, setPicked] = useState<string[]>([]);
  const [note, setNote] = useState("");
  if (!person || !person.verified) {
    return (
      <Screen title="Profile" back="/drop">
        <p className="text-mute">That profile isn't available.</p>
      </Screen>
    );
  }
  function toggle(key: string) {
    setPicked((list) => (list.includes(key) ? list.filter((item) => item !== key) : [...list, key]));
  }
  const intent =
    person.intent === "both" ? "Dating or friends" : person.intent === "dating" ? "Here for dating" : "Here for friends";
  return (
    <Screen title={person.name.split(" ")[0]} back="/drop" tab bleed>
      <div>
        <Portrait
          name={person.name}
          palette={person.palette}
          src={photoSrc(state.preview, person.id)}
          className="h-72 w-full"
        />
        <div className="relative z-10 -mt-8 space-y-4 rounded-t-[28px] bg-ink px-4 pb-8 pt-5">
          <div>
            <h2 className="font-serif text-5xl leading-none">
              {person.name.split(" ")[0]}, {person.age}
            </h2>
            <p className="mt-2 text-sm text-mute">
              {roleLine(person.bio)} · {person.area} · {person.languages.join(", ")}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className="inline-flex min-h-9 items-center rounded-full bg-mint/15 px-3 text-xs font-semibold text-mint">
              Live selfie matched
            </span>
            <span className="inline-flex min-h-9 items-center rounded-full border border-line bg-card px-3 text-xs">{intent}</span>
            <span className="inline-flex min-h-9 items-center rounded-full border border-line bg-card px-3 text-xs text-mute">
              {person.food}
            </span>
          </div>
          <p className="text-sm">{person.bio}</p>
          <h3 className="text-xs font-bold tracking-[0.16em] text-mute">TAP WHAT YOU LIKE</h3>
          <div className="space-y-3">
            {person.voice.map((voice) => (
              <button
                key={voice.prompt}
                type="button"
                onClick={() => toggle(`voice:${voice.prompt}`)}
                className={`min-h-11 w-full rounded-3xl border p-4 text-left ${picked.includes(`voice:${voice.prompt}`) ? "border-gold bg-card2" : "border-line bg-card"}`}
              >
                <span className="text-xs text-mute">Voice · {voice.seconds}s</span>
                <span className="mt-1 block font-medium">{voice.prompt}</span>
              </button>
            ))}
            {person.prompts.map((prompt) => (
              <button
                key={prompt.q}
                type="button"
                onClick={() => toggle(`prompt:${prompt.q}`)}
                className={`min-h-11 w-full rounded-3xl border p-4 text-left ${picked.includes(`prompt:${prompt.q}`) ? "border-gold bg-card2" : "border-line bg-card"}`}
              >
                <span className="text-xs text-mute">{prompt.q}</span>
                <span className="mt-1 block font-serif text-2xl leading-snug">{prompt.a}</span>
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => toggle("photo")}
            className={`w-full overflow-hidden rounded-3xl border text-left ${picked.includes("photo") ? "border-gold" : "border-line"}`}
          >
            <Portrait name={person.name} palette={person.palette} src={photoSrc(state.preview, person.id)} className="h-40 w-full" />
          </button>
          <Card>
            <p className="text-sm text-mint">
              {person.vouches} {person.vouches === 1 ? "friend vouches" : "friends vouch"} for {person.name.split(" ")[0]}
            </p>
          </Card>
          <textarea
            className={`${inputClass} h-24 py-3`}
            placeholder="A short note, if you want"
            maxLength={140}
            value={note}
            onChange={(event) => setNote(event.target.value)}
          />
          <p className="text-right text-xs text-mute">{note.length}/140</p>
          <div className="grid grid-cols-2 gap-3">
            <Button
              variant="ghost"
              onClick={() => {
                void blockPerson(current(), person.id).then((next) => {
                  commit(next);
                  navigate("/drop");
                });
              }}
            >
              Block
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                commit(skipPerson(current(), person.id));
                navigate("/drop");
              }}
            >
              Skip
            </Button>
            <Button
              onClick={() => {
                void likePerson(current(), person.id, note.trim(), picked).then((result) => {
                  commit(result.state);
                  navigate(result.matched ? `/match/${person.id}` : "/drop");
                });
              }}
            >
              Send like
            </Button>
          </div>
        </div>
      </div>
    </Screen>
  );
}

const GIFTS = [
  [7, "A week of filter coffee"],
  [30, "A book from a city bookshop"],
  [90, "Dinner for two at a partner café"],
  [180, "A weekend pottery class"],
  [365, "A quiet night at a partner table"],
] as const;

export function StreakScreen() {
  const now = useNow();
  const { state, current, commit } = useStore();
  const navigate = useNavigate();
  const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const weekday = new Intl.DateTimeFormat("en-IN", { weekday: "short", timeZone: "Asia/Kolkata" }).format(now);
  const todayIndex = Math.max(0, days.findIndex((day) => weekday.startsWith(day.slice(0, 2))));
  const active = state.streak.count > 0 && !state.streak.frozenByAway;
  const count = state.streak.count;
  const nextMilestone = MILESTONES.find((day) => day > count) ?? MILESTONES[MILESTONES.length - 1];
  const lastMilestone = [...MILESTONES].reverse().find((day) => day <= count) ?? 0;
  const progress =
    count >= nextMilestone ? 100 : Math.round(((count - lastMilestone) / (nextMilestone - lastMilestone)) * 100);
  return (
    <Screen back="/drop" tab>
      <Headline text={`${state.streak.count}-day streak`} italic="streak" className="!text-[52px]" />
      <p className="mt-2 text-sm text-mute">Show up, meet great people, and unlock special rewards.</p>
      <div className="mt-5 flex items-center gap-3">
        <div
          className="grid h-28 w-28 shrink-0 place-items-center rounded-full"
          style={{ background: `conic-gradient(#FFB547 0 ${progress}%, #3A2A48 ${progress}% 100%)` }}
          role="img"
          aria-label={`${count} of ${nextMilestone} days to the next milestone`}
        >
          <div className="grid h-[5.4rem] w-[5.4rem] place-items-center rounded-full bg-ink text-center">
            <span>
              <span className="block font-serif text-4xl leading-none">{count}</span>
              <span className="text-[10px] uppercase tracking-wider text-mute">of {nextMilestone}</span>
            </span>
          </div>
        </div>
        <div className="min-w-0 flex-1">
          <div className="grid grid-cols-7 gap-1 text-center text-[10px] text-mute">
            {days.map((day, index) => {
              const checked = active && index <= todayIndex && state.streak.count > todayIndex - index;
              return (
                <div key={day}>
                  <div className={`mx-auto grid h-6 w-6 place-items-center rounded-full text-[10px] ${checked ? "bg-gold text-ink" : "bg-card text-mute"}`}>
                    {checked ? <Check size={12} strokeWidth={3} aria-hidden /> : null}
                  </div>
                  <div className="mt-1">{day}</div>
                </div>
              );
            })}
          </div>
          <Card className="mt-3 p-3">
            <p className="flex items-center gap-2 text-sm font-semibold">
              <Snowflake size={16} className="text-lilac" />
              {state.streak.freezesLeft} streak freezes left this month
            </p>
            <p className="mt-1 text-xs text-mute">
              {state.streak.frozenByAway ? "Frozen while you're away." : "Use a freeze to protect your streak."}
            </p>
          </Card>
        </div>
      </div>
      <div className="mt-6 flex items-end justify-between">
        <h3 className="font-serif text-3xl">Streak milestones</h3>
      </div>
      <div className="mt-3 space-y-3">
        {GIFTS.map(([day, label]) => {
          const reached = state.streak.count >= day;
          return (
            <Card key={day}>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm text-mute">Day {day}</p>
                  <p className="font-medium">{label}</p>
                </div>
                <span className={reached ? "text-sm font-semibold text-mint" : "text-sm text-mute"}>
                  {reached ? "Unlocked" : "Ahead"}
                </span>
              </div>
            </Card>
          );
        })}
      </div>
      <p className="mt-4 text-xs text-mute">
        Opening your Drop keeps the streak alive. Milestones {MILESTONES.join(", ")}. The count itself is decided on the server.
      </p>
      <div className="mt-4 space-y-3">
        <Button variant="ghost" onClick={() => commit(freezeStreak(current()))}>
          Use a freeze
        </Button>
        <Button onClick={() => navigate("/you/plus")}>Get Closer+ to unlock gifts</Button>
      </div>
    </Screen>
  );
}

export function Mutual() {
  const { id = "" } = useParams();
  const person = personOf(id);
  const navigate = useNavigate();
  const { state, current, commit } = useStore();
  const [slot, setSlot] = useState("");
  const [kind, setKind] = useState<PlanKind>("coffee");
  const [venueId, setVenueId] = useState(VENUES[0].id);
  const [error, setError] = useState("");
  if (!person) return <Screen title="Plan" back="/drop"><p>They're not here.</p></Screen>;
  const overlap = person.freeSlots.filter((item) => state.draft.freeSlots.includes(item));
  const like = state.likes.find((item) => item.personId === person.id);
  return (
    <Screen back="/drop" tab>
      <div className="flex items-center justify-center gap-2 py-2">
        <Portrait
          name={state.draft.name || "You"}
          palette={["#3E2A22", "#FFB547"]}
          src={
            state.displayMode === "photo" && state.preview ? SELF_PHOTOS[0] : undefined
          }
          mode={state.displayMode}
          className="h-24 w-24 rounded-full border-2 border-gold object-cover"
        />
        <span className="grid h-8 w-8 place-items-center rounded-full bg-gold text-ink">
          <Heart size={16} fill="currentColor" aria-hidden />
        </span>
        <Portrait
          name={person.name}
          palette={person.palette}
          src={photoSrc(state.preview, person.id)}
          className="h-24 w-24 rounded-full border-2 border-gold object-cover"
        />
      </div>
      <Headline text="It's mutual." italic="mutual" className="mt-2 text-center !text-[52px]" />
      <Card className="mt-4">
        <p className="text-sm text-mute">
          {person.name.split(" ")[0]} liked you too.
          {like?.note ? ` You wrote: “${like.note}”` : " Pick a time you can both keep."}
        </p>
      </Card>
      <h3 className="mt-6 font-serif text-3xl">When are you free?</h3>
      <p className="mt-1 text-sm text-mute">Mint marks times you're both free. A gold chip is the one you'll book.</p>
      <div className="mt-3 grid grid-cols-2 gap-2">
        {person.freeSlots.map((item) => {
          const shared = overlap.includes(item);
          const selected = slot === item;
          return (
            <button
              key={item}
              type="button"
              onClick={() => setSlot(item)}
              className={`flex min-h-14 items-center justify-between rounded-2xl border px-3 text-left text-sm font-semibold ${
                selected ? "border-gold bg-gold text-ink" : shared ? "border-mint/50 bg-card text-cream" : "border-line bg-card text-mute"
              }`}
            >
              <span>{item}</span>
              <span className={`h-2.5 w-2.5 rounded-full ${selected ? "bg-ink" : shared ? "bg-mint" : "bg-line"}`} />
            </button>
          );
        })}
      </div>
      {slot && overlap.includes(slot) ? (
        <p className="mt-3 rounded-2xl bg-card px-3 py-2 text-sm text-mint">You both work {slot}</p>
      ) : null}
      <h3 className="mt-6 font-serif text-3xl">What kind of plan?</h3>
      <div className="mt-3 flex flex-wrap gap-2">
        {PLAN_KINDS.map((item) => (
          <Chip key={item.id} active={kind === item.id} onClick={() => setKind(item.id)}>
            {item.label}
          </Chip>
        ))}
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        {VENUES.map((venue) => (
          <Chip key={venue.id} active={venueId === venue.id} onClick={() => setVenueId(venue.id)}>
            {venue.name}
          </Chip>
        ))}
      </div>
      <p className="mt-3 text-xs text-mute">You pick the public place. The ₹99 deposit is still part of booking.</p>
      {error ? <p className="mt-3 text-sm text-coral">{error}</p> : null}
      <div className="mt-5">
        <Button
          disabled={!slot || (overlap.length > 0 && !overlap.includes(slot))}
          onClick={() => {
            void bookPlan(current(), { personId: person.id, venueId, slot, kind }).then((result) => {
              commit(result.state);
              if (result.error || !result.planId) setError(result.error || "Couldn't book");
              else navigate(`/plans/${result.planId}`);
            });
          }}
        >
          Book it
        </Button>
      </div>
    </Screen>
  );
}
