import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { PEOPLE, personById } from "../../mocks/people";
import { VENUES } from "../../mocks/catalog";
import { currentDropDate, formatIstDay, formatRemain, nextDropAt } from "../../lib/time";
import { MILESTONES, PLAN_KINDS, type PlanKind } from "../../lib/types";
import { bookPlan, freezeStreak, joinTable, likePerson, openDrop, skipPerson } from "../../state/logic";
import { useStore } from "../../state/store";
import { Button, Card, Chip, VerifiedPill, inputClass } from "../../ui/primitives";
import { Screen } from "../../ui/shell";
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

export function DropHome() {
  const now = useNow();
  const navigate = useNavigate();
  const { state, current, commit } = useStore();
  useEffect(() => {
    commit(openDrop(current(), new Date()));
  }, [commit, current]);
  const picks = useMemo(
    () =>
      selectDrop(PEOPLE, prefsOf(state), currentDropDate(now), {
        viewerHash: state.draft.phoneHash,
        blocked: state.blocks,
        banned: [],
        now,
        away: Boolean(state.away),
        paused: state.paused,
      }).filter((person) => !state.skips.includes(person.id) && !state.likes.some((like) => like.personId === person.id)),
    [now, state],
  );
  const remain = formatRemain(nextDropAt(now).getTime() - now.getTime());
  return (
    <Screen tab>
      <div className="px-5 pb-8">
        <CityMark className="h-12 w-16 text-gold/80" />
        <p className="mt-3 text-sm text-mute">{formatIstDay(now)}</p>
        <h2 className="mt-1 font-serif text-5xl leading-none">
          Tonight's <span className="italic text-gold">drop</span>
        </h2>
        <div className="mt-4 flex items-center justify-between">
          <p className="text-sm text-mute">Next three at 9:00 pm · {remain}</p>
          <button type="button" onClick={() => navigate("/streak")} className="rounded-full bg-gold px-3 py-1.5 text-sm font-semibold text-ink">
            {state.streak.count} day streak
          </button>
        </div>
        {state.away ? (
          <Card className="mt-4">
            <p className="font-semibold">Away is on</p>
            <p className="mt-1 text-sm text-mute">The Drop is paused and your streak is frozen.</p>
            <button type="button" className="mt-3 text-sm font-semibold text-gold" onClick={() => navigate("/away")}>
              Change away
            </button>
          </Card>
        ) : null}
        {state.paused ? <p className="mt-4 text-sm text-mute">Your profile is paused. No one new will see you.</p> : null}
        <div className="mt-5 space-y-4">
          {picks.map((person) => (
            <button key={person.id} type="button" onClick={() => navigate(`/person/${person.id}`)} className="w-full overflow-hidden rounded-3xl border border-line bg-card text-left">
              <Portrait name={person.name} palette={person.palette} className="h-72 w-full" />
              <div className="space-y-2 p-4">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="font-serif text-4xl">
                    {person.name.split(" ")[0]} <span className="italic text-gold">{person.age}</span>
                  </h3>
                  <VerifiedPill />
                </div>
                <p className="text-sm text-mute">
                  {person.area} · {person.intent === "both" ? "Dating or friends" : person.intent === "dating" ? "Dating" : "Friends"}
                </p>
              </div>
            </button>
          ))}
          {picks.length === 0 && !state.away ? (
            <Card>
              <p className="font-semibold">No one new with these preferences.</p>
              <p className="mt-1 text-sm text-mute">Widen an area or an age range. We won't invent people to fill the three.</p>
            </Card>
          ) : null}
        </div>
        <Card className="mt-5">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gold">Table of six</p>
          <h3 className="mt-2 font-serif text-3xl">Saturday supper</h3>
          <p className="mt-1 text-sm text-mute">Banjara Hills · 8:30 pm. One long table. Phones down for the first hour.</p>
          <div className="mt-4">
            <Button disabled={state.tableSeat} onClick={() => commit(joinTable(current()))}>
              {state.tableSeat ? "Seat requested" : "Request a seat"}
            </Button>
          </div>
        </Card>
      </div>
    </Screen>
  );
}

export function Profile() {
  const { id = "" } = useParams();
  const person = personById(id);
  const navigate = useNavigate();
  const { current, commit } = useStore();
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
  return (
    <Screen title={person.name.split(" ")[0]} back="/drop">
      <div className="space-y-4">
        <Portrait name={person.name} palette={person.palette} className="h-80 w-full rounded-3xl" />
        <div className="flex flex-wrap gap-2">
          <VerifiedPill />
          <span className="rounded-full bg-card px-3 py-1 text-xs text-mute">{person.area}</span>
          <span className="rounded-full bg-card px-3 py-1 text-xs text-mute">{person.languages.join(" · ")}</span>
          <span className="rounded-full bg-card px-3 py-1 text-xs text-mute">{person.food}</span>
        </div>
        <p>{person.bio}</p>
        <h3 className="font-serif text-3xl">
          Tap what you <span className="italic text-gold">like</span>
        </h3>
        {person.voice.map((voice) => (
          <button key={voice.prompt} type="button" onClick={() => toggle(`voice:${voice.prompt}`)} className={`w-full rounded-3xl border p-4 text-left ${picked.includes(`voice:${voice.prompt}`) ? "border-gold" : "border-line bg-card"}`}>
            <span className="text-xs text-mute">Voice · {voice.seconds}s</span>
            <span className="mt-1 block font-medium">{voice.prompt}</span>
          </button>
        ))}
        {person.prompts.map((prompt) => (
          <button key={prompt.q} type="button" onClick={() => toggle(`prompt:${prompt.q}`)} className={`w-full rounded-3xl border p-4 text-left ${picked.includes(`prompt:${prompt.q}`) ? "border-gold" : "border-line bg-card"}`}>
            <span className="text-xs text-mute">{prompt.q}</span>
            <span className="mt-1 block font-medium">{prompt.a}</span>
          </button>
        ))}
        <button type="button" onClick={() => toggle("photo")} className={`w-full overflow-hidden rounded-3xl border text-left ${picked.includes("photo") ? "border-gold" : "border-line"}`}>
          <Portrait name={person.name} palette={person.palette} className="h-40 w-full" />
        </button>
        <Card>
          <p className="text-sm text-mint">{person.vouches} {person.vouches === 1 ? "friend vouches" : "friends vouch"} for {person.name.split(" ")[0]}</p>
        </Card>
        <textarea className={`${inputClass} h-24 py-3`} placeholder="A short note, if you want" value={note} onChange={(event) => setNote(event.target.value)} />
        <div className="grid grid-cols-2 gap-3">
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
              const result = likePerson(current(), person.id, note.trim(), picked);
              commit(result.state);
              navigate(result.matched ? `/match/${person.id}` : "/drop");
            }}
          >
            Send like
          </Button>
        </div>
      </div>
    </Screen>
  );
}

export function StreakScreen() {
  const { state, current, commit } = useStore();
  const gifts = [
    [7, "A week of filter coffee"],
    [30, "A book from a city bookshop"],
    [90, "Dinner for two at a partner café"],
    [180, "A weekend pottery class"],
    [365, "A quiet night at a partner table"],
  ] as const;
  return (
    <Screen title="Streak" back="/drop">
      <h2 className="font-serif text-6xl leading-none">
        {state.streak.count} <span className="italic text-gold">days</span>
      </h2>
      <p className="mt-3 text-sm text-mute">
        {state.streak.frozenByAway
          ? "Frozen while you're away."
          : `${state.streak.freezesLeft} freezes left this month. A freeze covers one missed day.`}
      </p>
      <div className="mt-6 space-y-3">
        {gifts.map(([day, label]) => (
          <Card key={day}>
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm text-mute">Day {day}</p>
                <p className="font-medium">{label}</p>
              </div>
              <span className={state.streak.count >= day ? "text-mint" : "text-mute"}>{state.streak.count >= day ? "Reached" : "Ahead"}</span>
            </div>
          </Card>
        ))}
      </div>
      <div className="mt-5">
        <Button variant="ghost" onClick={() => commit(freezeStreak(current()))}>
          Use a freeze
        </Button>
      </div>
      <p className="mt-4 text-sm text-mute">Milestones {MILESTONES.join(", ")}. The count itself is decided on the server.</p>
    </Screen>
  );
}

export function Mutual() {
  const { id = "" } = useParams();
  const person = personById(id);
  const navigate = useNavigate();
  const { state, current, commit } = useStore();
  const [slot, setSlot] = useState("");
  const [kind, setKind] = useState<PlanKind>("coffee");
  const [venueId, setVenueId] = useState(VENUES[0].id);
  const [error, setError] = useState("");
  if (!person) return <Screen title="Plan" back="/drop"><p>They're not here.</p></Screen>;
  const overlap = person.freeSlots.filter((item) => state.draft.freeSlots.includes(item));
  return (
    <Screen title="It's mutual" back="/drop">
      <Portrait name={person.name} palette={person.palette} className="h-48 w-full rounded-3xl" />
      <h2 className="mt-4 font-serif text-4xl">
        {person.name.split(" ")[0]} likes you <span className="italic text-gold">too</span>
      </h2>
      <p className="mt-2 text-sm text-mute">Mint dots are times you're both free.</p>
      <div className="mt-4 flex flex-wrap gap-2">
        {person.freeSlots.map((item) => {
          const shared = overlap.includes(item);
          return (
            <button key={item} type="button" onClick={() => setSlot(item)} className={`min-h-11 rounded-full border px-3 text-sm ${slot === item ? "border-gold bg-gold text-ink" : shared ? "border-mint text-mint" : "border-line text-mute"}`}>
              {shared ? "● " : ""}
              {item}
            </button>
          );
        })}
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
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
      {error ? <p className="mt-3 text-sm text-coral">{error}</p> : null}
      <div className="mt-5">
        <Button
          disabled={!slot || (overlap.length > 0 && !overlap.includes(slot))}
          onClick={() => {
            const result = bookPlan(current(), { personId: person.id, venueId, slot, kind });
            commit(result.state);
            if (result.error || !result.planId) setError(result.error || "Couldn't book");
            else navigate(`/plans/${result.planId}`);
          }}
        >
          Book it
        </Button>
      </div>
    </Screen>
  );
}
