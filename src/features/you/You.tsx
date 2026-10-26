import { ChevronRight, Download, Shield, Sparkles, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { MILESTONES, type DisplayMode } from "../../lib/types";
import { addDays } from "../../lib/time";
import {
  blankState,
  claimGift,
  deleteAccount,
  enterPreview,
  purchasePlan,
  rechargeSaathi,
  restoreAccount,
  saveDraft,
  setDiscreet,
  setDisplayMode,
  setPaused,
  spendSaathiMinute,
} from "../../state/logic";
import { useStore } from "../../state/store";
import { Button, Card, Chip, Headline, Toggle, inputClass } from "../../ui/primitives";
import { SELF_PHOTOS, SAMPLE_FACES } from "../../ui/photos";
import { Screen } from "../../ui/shell";
import { CityMark, Portrait } from "../../ui/visuals";
import { Preferences } from "../onboarding/Onboarding";
import { SAATHI_OPENERS } from "../../mocks/catalog";

function years(dob: string) {
  if (!dob) return null;
  const born = new Date(`${dob}T00:00:00`);
  if (Number.isNaN(born.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - born.getFullYear();
  const month = now.getMonth() - born.getMonth();
  if (month < 0 || (month === 0 && now.getDate() < born.getDate())) age -= 1;
  return age;
}

export function YouHome() {
  const { state, current, commit } = useStore();
  const navigate = useNavigate();
  const age = years(state.draft.dob);
  const area = state.draft.areas[0] || "Hyderabad";
  const links = [
    ["/you/preferences", "Preferences"],
    ["/you/gift", "Streak gift"],
    ["/you/settings", "Settings"],
    ["/you/licences", "Open-source licences"],
  ] as const;
  return (
    <Screen tab title={state.discreet ? "Notes" : "You"}>
      <div className="flex items-center gap-4">
        <Portrait
          name={state.draft.name || "You"}
          palette={["#3E2A22", "#FFB547"]}
          src={
            state.displayMode === "photo" && state.preview
              ? (SELF_PHOTOS[state.draft.mainPhoto] ?? SELF_PHOTOS[0])
              : undefined
          }
          className="h-24 w-24 rounded-full"
          mode={state.displayMode}
        />
        <div>
          <h2 className="font-serif text-4xl">{state.discreet ? "Notes" : state.draft.name || "You"}</h2>
          <p className="text-sm text-mute">{age ? `${age} · ${area}` : area}</p>
          <p className="text-sm text-mint">{state.draft.selfieDone ? "Verified on this phone" : "Verification pending"}</p>
        </div>
      </div>
      <div className="mt-5 grid grid-cols-3 gap-2">
        {[
          [String(state.streak.count), "Streak"],
          [String(state.matches.length), "Mutual"],
          [String(state.plans.filter((plan) => plan.status === "upcoming").length), "Plans"],
        ].map(([value, label]) => (
          <Card key={label} className="px-2 py-3 text-center">
            <p className="font-serif text-2xl">{value}</p>
            <p className="text-xs text-mute">{label}</p>
          </Card>
        ))}
      </div>
      <Card className="mt-4">
        <p className="text-sm text-mute">Ask a friend to vouch. The link opens WhatsApp with a note, not your private chats.</p>
        <a className="mt-3 inline-flex min-h-11 items-center font-semibold text-gold" href={`https://wa.me/?text=${encodeURIComponent("Would you vouch for me on Closer? It's a verified Hyderabad app.")}`}>
          Request a vouch
        </a>
      </Card>
      <div className="mt-4 space-y-3">
        <Toggle on={state.draft.hideFromContacts} onChange={(hideFromContacts) => commit(saveDraft(current(), { hideFromContacts }))} label="Hide me from all my contacts" hint="On by default. People you allow can still see you." />
        <Toggle on={state.discreet} onChange={(discreet) => commit(setDiscreet(current(), discreet))} label="Discreet mode" hint="The title becomes Notes, and names blur in rooms." />
        <Toggle on={state.paused} onChange={(paused) => commit(setPaused(current(), paused))} label="Pause my profile" hint="You disappear from the Drop until you turn this off." />
      </div>
      <button type="button" onClick={() => navigate("/you/plus")} className="mt-4 flex min-h-11 w-full items-center gap-3 rounded-3xl border border-gold/40 bg-card px-4 py-3 text-left">
        <Sparkles size={18} className="text-gold" />
        <span className="min-w-0 flex-1">
          <span className="block font-semibold">Closer+</span>
          <span className="block text-sm text-mute">{state.plus ? "On in this preview" : "Four plans, an extra freeze, ₹299"}</span>
        </span>
        <ChevronRight size={18} className="text-mute" />
      </button>
      <button type="button" onClick={() => navigate("/you/saathi")} className="mt-2 flex min-h-11 w-full items-center gap-3 rounded-3xl border border-line bg-card px-4 py-3 text-left">
        <span className="rounded-full bg-lilac/20 px-2 py-1 text-[10px] font-semibold text-lilac">AI</span>
        <span className="min-w-0 flex-1">
          <span className="block font-semibold">Saathi</span>
          <span className="block text-sm text-mute">An AI companion. Not a person on Closer.</span>
        </span>
        <ChevronRight size={18} className="text-mute" />
      </button>
      <div className="mt-3 space-y-2">
        <button type="button" onClick={() => navigate("/safety")} className="flex min-h-11 w-full items-center gap-3 rounded-2xl border border-line px-4 text-left">
          <Shield size={16} className="text-mint" /> Safety <ChevronRight size={16} className="ml-auto text-mute" />
        </button>
        {links.map(([path, label]) => (
          <button key={path} type="button" onClick={() => navigate(path)} className="flex min-h-11 w-full items-center rounded-2xl border border-line px-4 text-left">
            {label}
            <ChevronRight size={16} className="ml-auto text-mute" />
          </button>
        ))}
        <button
          type="button"
          onClick={() => navigate("/you/settings")}
          className="flex min-h-11 w-full items-center gap-3 rounded-2xl border border-line px-4 text-left"
        >
          <Download size={16} /> Download my data
          <ChevronRight size={16} className="ml-auto text-mute" />
        </button>
        <button type="button" onClick={() => navigate("/you/settings")} className="flex min-h-11 w-full items-center gap-3 rounded-2xl border border-coral/40 px-4 text-left text-coral">
          <Trash2 size={16} /> Delete account
        </button>
      </div>
    </Screen>
  );
}

export function PreferencesEdit() {
  const { state, current, commit } = useStore();
  const navigate = useNavigate();
  return (
    <Screen title="Preferences" back="/you">
      <Preferences draft={state.draft} onChange={(patch) => commit(saveDraft(current(), patch))} onNext={() => navigate("/you")} />
    </Screen>
  );
}

export function Plus() {
  const { state, current, commit } = useStore();
  return (
    <Screen title="Closer+" back="/you">
      <Headline text="A little more room" italic="room" />
      <ul className="mt-4 space-y-2 text-sm text-mute">
        <li>Four open plans instead of three.</li>
        <li>One extra streak freeze each month.</li>
        <li>Keep a chat after the 48 hours, if they keep it too.</li>
        <li>Twenty Saathi minutes when you subscribe.</li>
      </ul>
      <p className="mt-4 text-sm text-mute">No “see who liked you”. If it isn’t mutual, you aren’t told.</p>
      <div className="mt-5 space-y-3">
        <Button onClick={() => commit(purchasePlan(current(), "month"))}>₹299 / month</Button>
        <Button variant="ghost" onClick={() => commit(purchasePlan(current(), "quarter"))}>₹799 / 3 months</Button>
      </div>
      {state.plus ? <p className="mt-4 text-sm text-mint">Closer+ is on in this preview. A real charge needs Razorpay.</p> : null}
    </Screen>
  );
}

export function GiftClaim() {
  const { state, current, commit } = useStore();
  const [gift, setGift] = useState("Filter coffee for a week");
  const [address, setAddress] = useState("");
  const next = MILESTONES.find((day) => state.streak.count >= day && !state.streak.giftsClaimed.includes(day));
  return (
    <Screen title="Streak gift" back="/you">
      {next ? (
        <>
          <Headline text={`Day ${next} is yours`} italic="yours" />
          <div className="mt-4 flex flex-wrap gap-2">
            {["Filter coffee for a week", "A city book", "Café credit"].map((item) => (
              <Chip key={item} active={gift === item} onClick={() => setGift(item)}>{item}</Chip>
            ))}
          </div>
          <textarea className="mt-4 h-28 w-full rounded-2xl border border-line bg-card p-3" placeholder="Address for fulfilment" value={address} onChange={(event) => setAddress(event.target.value)} />
          <p className="mt-2 text-xs text-mute">The address is visible only to the fulfilment admin, not to matches.</p>
          <div className="mt-4">
            <Button onClick={() => commit(claimGift(current(), next, gift, address))}>Claim</Button>
          </div>
        </>
      ) : (
        <>
          <Headline text="No gift is ready" italic="gift" />
          <p className="mt-2 text-sm text-mute">The next marks are {MILESTONES.join(", ")}.</p>
        </>
      )}
      {state.giftClaim ? <p className="mt-4 text-sm text-mint">{state.giftClaim.gift} is with fulfilment.</p> : null}
    </Screen>
  );
}

export function Saathi() {
  const { state, current, commit } = useStore();
  const [lines, setLines] = useState<string[]>([SAATHI_OPENERS[0]]);
  const [text, setText] = useState("");
  const [running, setRunning] = useState(false);
  useEffect(() => {
    if (!running) return undefined;
    const timer = window.setInterval(() => {
      const next = spendSaathiMinute(current());
      commit(next);
      if (next.saathiMinutes <= 0) setRunning(false);
    }, 60000);
    return () => window.clearInterval(timer);
  }, [running, commit, current]);
  return (
    <Screen title="Saathi" back="/you">
      <Headline text="Talk with Saathi" italic="Saathi" />
      <p className="mt-3 inline-flex min-h-11 items-center rounded-full bg-lilac/20 px-3 text-xs font-semibold text-lilac">AI · not a person on Closer</p>
      <div className="mt-4 space-y-2">
        {lines.map((line) => (
          <p key={line} className="rounded-2xl bg-card p-3 text-sm">{line}</p>
        ))}
      </div>
      <p className="mt-3 text-sm text-mute">{state.saathiMinutes} minutes left. Minutes come off on the server.</p>
      <div className="mt-4 flex gap-2">
        <input className={inputClass} value={text} onChange={(event) => setText(event.target.value)} placeholder="Say something" />
      </div>
      <div className="mt-3 space-y-2">
        <Button
          disabled={!text.trim() || state.saathiMinutes <= 0}
          onClick={() => {
            if (!running) {
              const next = spendSaathiMinute(current());
              commit(next);
              setRunning(true);
            }
            setLines((list) => [...list, text.trim(), "I'm still an AI. I can help you phrase a note, and I can't meet you."]);
            setText("");
          }}
        >
          {running ? "Send" : "Start AI session"}
        </Button>
        <Button variant="ghost" onClick={() => commit(rechargeSaathi(current(), 30))}>Add 30 minutes (preview)</Button>
      </div>
    </Screen>
  );
}

export function Settings() {
  const { state, current, commit } = useStore();
  const navigate = useNavigate();
  const [confirm, setConfirm] = useState("");
  const modes: DisplayMode[] = ["photo", "avatar", "initials"];
  return (
    <Screen title="Settings" back="/you">
      <div className="space-y-3">
        <Toggle on={state.paused} onChange={(paused) => commit(setPaused(current(), paused))} label="Pause my profile" hint="You disappear from the Drop until you turn this off." />
        <Toggle on={state.discreet} onChange={(discreet) => commit(setDiscreet(current(), discreet))} label="Discreet mode" hint="The title becomes Notes, and names blur in rooms." />
        <p className="text-sm text-mute">How you appear in rooms</p>
        <div className="flex gap-2">
          {modes.map((mode) => (
            <Chip key={mode} active={state.displayMode === mode} onClick={() => commit(setDisplayMode(current(), mode))}>{mode}</Chip>
          ))}
        </div>
        <Button
          variant="ghost"
          onClick={() => {
            const { contacts: _contacts, ...draft } = state.draft;
            const blob = new Blob([JSON.stringify({ ...state, draft }, null, 2)], { type: "application/json" });
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = url;
            link.download = "closer-data.json";
            link.click();
            URL.revokeObjectURL(url);
          }}
        >
          Download my data
        </Button>
        <Card>
          <p className="text-sm">Delete is a 30-day soft close. Type DELETE to confirm.</p>
          <input className={`${inputClass} mt-3`} value={confirm} onChange={(event) => setConfirm(event.target.value)} />
          <div className="mt-3">
            <Button
              variant="danger"
              disabled={confirm !== "DELETE"}
              onClick={() => {
                commit(deleteAccount(current()));
                navigate("/");
              }}
            >
              Delete account
            </Button>
          </div>
        </Card>
        <Button variant="ghost" onClick={() => { commit(blankState()); navigate("/"); }}>
          Start over on this device
        </Button>
      </div>
    </Screen>
  );
}

export function Licences() {
  return (
    <Screen title="Licences" back="/you">
      <div className="space-y-4 text-sm text-mute">
        <p>Closer keeps MIT, Apache-2.0 and BSD code, with the original licences.</p>
        <p><span className="text-cream">boardgame.io</span> — MIT. Turn-based rules for Ludo and the other tables.</p>
        <p><span className="text-cream">LiveKit</span> — Apache-2.0. Voice rooms, when a server URL is configured.</p>
        <p>Housie, Antakshari, This or That and the Tollywood questions are written for Closer. UNO, Codenames and other trademarked games are not included.</p>
      </div>
    </Screen>
  );
}

export function Welcome() {
  const { state, commit } = useStore();
  const navigate = useNavigate();
  if (state.deletedAt) {
    const purge = addDays(new Date(state.deletedAt), 30);
    return (
      <Screen>
        <h2 className="font-serif text-5xl">Account <span className="italic text-gold">closed</span></h2>
        <p className="mt-3 text-sm text-mute">It will be erased on {purge.toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata" })}. You can restore it until then.</p>
        <div className="mt-6"><Button onClick={() => { commit(restoreAccount(state)); navigate("/drop"); }}>Restore</Button></div>
      </Screen>
    );
  }
  return (
    <div className="flex flex-1 flex-col bg-ink px-4 pb-8 pt-5">
      <div className="flex items-center justify-between">
        <span className="font-serif text-[28px] italic leading-none">closer</span>
        <span className="rounded-full border border-line bg-card px-3 py-1.5 text-xs text-mute">Hyderabad · 18+</span>
      </div>
      <div className="relative mt-4 overflow-hidden rounded-[28px] border border-line bg-card">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_70%_30%,rgba(255,181,71,0.2),transparent_40%),linear-gradient(180deg,#2A1840,#160E1F)]" />
        <CityMark className="absolute right-3 top-3 h-16 w-24 text-gold" />
        <div className="relative flex items-end gap-2 px-4 pb-4 pt-28">
          <img src={SAMPLE_FACES.sameera} alt="" className="h-28 w-20 rounded-2xl object-cover" />
          <img src={SAMPLE_FACES.ananya} alt="" className="h-36 w-28 rounded-2xl object-cover" />
          <img src={SAMPLE_FACES.divya} alt="" className="h-28 w-20 rounded-2xl object-cover" />
        </div>
        <div className="absolute left-4 top-3 grid h-24 w-24 place-items-center rounded-full border border-gold/80 bg-ink/80 text-center">
          <span>
            <span className="block text-[9px] tracking-[0.16em] text-mute">EVERY NIGHT</span>
            <span className="block font-serif text-3xl leading-none">9 pm</span>
            <span className="mt-1 block text-[10px] text-gold">The Drop</span>
          </span>
        </div>
      </div>
      <Headline text="Plans, not swipes." italic="not swipes." className="mt-6 !text-[52px]" />
      <p className="mt-3 text-mute">Three people every night at 9. Like each other, and we book the table.</p>
      <div className="mt-4 space-y-2">
        <p className="rounded-2xl border border-line bg-card px-4 py-3 text-sm">Everyone is live-selfie checked</p>
        <p className="rounded-2xl border border-line bg-card px-4 py-3 text-sm">A ₹99 deposit means people actually show up</p>
      </div>
      <div className="mt-auto space-y-3 pt-8">
        <Button onClick={() => navigate(state.draft.phone ? `/onboarding/${state.draft.step || "phone"}` : "/onboarding/phone")}>
          Get started
        </Button>
        <Button variant="ghost" onClick={() => { commit(enterPreview()); navigate("/drop"); }}>
          Look around first
        </Button>
        <p className="text-center text-xs text-mute">By continuing you agree to the community rules and privacy notice.</p>
      </div>
    </div>
  );
}
