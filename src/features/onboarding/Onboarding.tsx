import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { isAdult, maxDob } from "../../lib/age";
import { backendConfigured } from "../../lib/env";
import { contactPayload, hashPhone, normaliseE164 } from "../../lib/hash";
import { AREAS, FOODS, LANGUAGES, emptyDraft, type Draft, type Gender, type Intent, type ShowMe } from "../../lib/types";
import { completeOnboarding, saveDraft } from "../../state/logic";
import { useStore } from "../../state/store";
import { Button, Card, Chip, Field, Headline, ProgressBar, Toggle, inputClass } from "../../ui/primitives";
import { SAMPLE_FACES } from "../../ui/photos";
import { Screen } from "../../ui/shell";
import { verifySelfie } from "../safety/api";

const ORDER = ["phone", "otp", "basics", "intent", "selfie", "photos", "voice", "preferences", "contacts", "ready"];
const DEMO_OTP = "482913";

export function Onboarding() {
  const { step = "phone" } = useParams();
  const navigate = useNavigate();
  const { state, current, commit } = useStore();
  const draft = state.draft;
  const index = Math.max(0, ORDER.indexOf(step));

  function go(next: string, patch?: Partial<Draft>) {
    commit(saveDraft(current(), { ...patch, step: next }));
    navigate(`/onboarding/${next}`);
  }

  return (
    <Screen back={index === 0 ? "/" : `/onboarding/${ORDER[index - 1]}`}>
      <div className="mb-5 flex items-center gap-3">
        <div className="flex-1">
          <ProgressBar value={(index + 1) / ORDER.length} />
        </div>
        <span className="text-xs font-semibold text-mute">
          {index + 1}/{ORDER.length}
        </span>
      </div>
      {step === "phone" ? <Phone draft={draft} onNext={(phone) => go("otp", { phone })} /> : null}
      {step === "otp" ? (
        <Otp
          phone={draft.phone}
          onNext={async () => {
            const phoneHash = await hashPhone(draft.phone);
            go("basics", { otpVerified: true, phoneHash });
          }}
        />
      ) : null}
      {step === "basics" ? (
        <Basics
          draft={draft}
          onNext={(patch) => go("intent", patch)}
        />
      ) : null}
      {step === "intent" ? <IntentStep draft={draft} onNext={(intent) => go("selfie", { intent })} /> : null}
      {step === "selfie" ? <Selfie onNext={() => go("photos", { selfieDone: true })} /> : null}
      {step === "photos" ? (
        <Photos
          count={draft.photoCount}
          main={draft.mainPhoto}
          onChange={(photoCount, mainPhoto) => commit(saveDraft(current(), { photoCount, mainPhoto }))}
          onNext={() => go("voice")}
        />
      ) : null}
      {step === "voice" ? (
        <Voice
          voices={draft.voices}
          onChange={(voices) => commit(saveDraft(current(), { voices }))}
          onNext={() => go("preferences")}
        />
      ) : null}
      {step === "preferences" ? (
        <Preferences draft={draft} onChange={(patch) => commit(saveDraft(current(), patch))} onNext={() => go("contacts")} />
      ) : null}
      {step === "contacts" ? (
        <Contacts
          draft={draft}
          onChange={(patch) => commit(saveDraft(current(), patch))}
          onNext={async () => {
            const payload = await contactPayload(draft.contacts);
            go("ready", {
              contactHashes: payload.hashes,
              allowHashes: draft.hideFromContacts ? payload.allowlist : [],
            });
          }}
        />
      ) : null}
      {step === "ready" ? (
        <Ready
          onNext={(notifications) => {
            commit(completeOnboarding(saveDraft(current(), { notifications })));
            navigate("/drop");
          }}
        />
      ) : null}
    </Screen>
  );
}

function Phone({ draft, onNext }: { draft: Draft; onNext: (phone: string) => void }) {
  const [phone, setPhone] = useState(draft.phone.replace("+91", ""));
  const e164 = normaliseE164(phone);
  return (
    <div className="space-y-6">
      <Headline text="Your number" italic="number" />
      <p className="text-mute">Only used to sign you in. Never shown to anyone.</p>
      <Field label="Mobile">
        <span className="flex gap-2">
          <span className="grid h-14 w-20 shrink-0 place-items-center rounded-2xl border border-line bg-card text-sm font-semibold">+91</span>
          <input className={inputClass} inputMode="numeric" autoComplete="tel" placeholder="98480 12345" value={phone} onChange={(event) => setPhone(event.target.value)} />
        </span>
      </Field>
      <Button disabled={!e164} onClick={() => onNext(e164)}>
        Send code
      </Button>
    </div>
  );
}

function Otp({ phone, onNext }: { phone: string; onNext: () => void }) {
  const [code, setCode] = useState("");
  const valid = backendConfigured ? code.length === 6 : code === DEMO_OTP;
  return (
    <div className="space-y-6">
      <Headline text="Enter the code" italic="code" />
      <p className="text-mute">Sent to {phone}.</p>
      {backendConfigured ? null : (
        <Card>
          <p className="text-sm text-mute">No SMS provider is connected in this preview. Use code {DEMO_OTP}.</p>
        </Card>
      )}
      <div className="grid grid-cols-6 gap-2" role="group" aria-label="6-digit code">
        {Array.from({ length: 6 }, (_, index) => (
          <input
            key={index}
            aria-label={`Digit ${index + 1}`}
            inputMode="numeric"
            maxLength={1}
            value={code[index] ?? ""}
            className="h-14 w-full rounded-2xl border border-line bg-card text-center font-serif text-2xl text-cream outline-none"
            onChange={(event) => {
              const digit = event.target.value.replace(/\D/g, "").slice(-1);
              const next = code.padEnd(index, " ").slice(0, 6).split("");
              next[index] = digit;
              setCode(next.join("").replace(/\s/g, "").slice(0, 6));
              const sibling = event.target.nextElementSibling;
              if (digit && sibling instanceof HTMLInputElement) sibling.focus();
            }}
          />
        ))}
      </div>
      <Button disabled={!valid} onClick={onNext}>
        Continue
      </Button>
    </div>
  );
}

function Basics({ draft, onNext }: { draft: Draft; onNext: (patch: Partial<Draft>) => void }) {
  const [name, setName] = useState(draft.name);
  const [dob, setDob] = useState(draft.dob);
  const [gender, setGender] = useState<Gender | "">(draft.gender);
  const [showMe, setShowMe] = useState<ShowMe | "">(draft.showMe);
  const adult = dob ? isAdult(dob) : false;
  const ready = name.trim().length > 1 && adult && gender && showMe;
  return (
    <div className="space-y-5">
      <Headline text="About you" italic="you" />
      <Field label="First name">
        <input className={inputClass} value={name} onChange={(event) => setName(event.target.value)} />
      </Field>
      <Field label="Date of birth">
        <input className={inputClass} type="date" max={maxDob()} value={dob} onChange={(event) => setDob(event.target.value)} />
      </Field>
      {dob && !adult ? <p className="text-sm text-coral">Closer is only for adults. You can come back on your 18th birthday.</p> : null}
      <div className="flex flex-wrap gap-2">
        {(["woman", "man", "nonbinary"] as Gender[]).map((item) => (
          <Chip key={item} active={gender === item} onClick={() => setGender(item)}>
            {item === "nonbinary" ? "Non-binary" : item[0].toUpperCase() + item.slice(1)}
          </Chip>
        ))}
      </div>
      <p className="text-sm text-mute">Show me</p>
      <div className="flex flex-wrap gap-2">
        {(["women", "men", "everyone"] as ShowMe[]).map((item) => (
          <Chip key={item} active={showMe === item} onClick={() => setShowMe(item)}>
            {item[0].toUpperCase() + item.slice(1)}
          </Chip>
        ))}
      </div>
      <Button disabled={!ready} onClick={() => onNext({ name: name.trim(), dob, gender, showMe })}>
        Continue
      </Button>
    </div>
  );
}

function IntentStep({ draft, onNext }: { draft: Draft; onNext: (intent: Intent) => void }) {
  const options: { id: Intent; title: string; copy: string }[] = [
    { id: "dating", title: "Dating", copy: "I want to meet one person properly." },
    { id: "friends", title: "Friends", copy: "New people. No romance." },
    { id: "both", title: "Both", copy: "Open to wherever a good conversation goes." },
  ];
  return (
    <div className="space-y-4">
      <Headline text="What are you here for?" italic="here for?" />
      {options.map((option) => {
        const mark = option.id === "dating" ? "D" : option.id === "friends" ? "F" : "B";
        const tone = option.id === "dating" ? "bg-gold text-ink" : option.id === "friends" ? "bg-lilac text-ink" : "bg-mint text-ink";
        return (
          <button
            key={option.id}
            type="button"
            onClick={() => onNext(option.id)}
            className={`flex min-h-16 w-full items-center gap-3 rounded-3xl border p-4 text-left ${draft.intent === option.id ? "border-gold bg-card2" : "border-line bg-card"}`}
          >
            <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-2xl text-lg font-bold ${tone}`}>{mark}</span>
            <span className="min-w-0 flex-1">
              <span className="block text-lg font-semibold">{option.title}</span>
              <span className="mt-1 block text-sm text-mute">{option.copy}</span>
            </span>
          </button>
        );
      })}
      <Card>
        <p className="text-sm text-mute">Tables of 6 stay open to everyone. This choice only changes who is in your Drop.</p>
      </Card>
    </div>
  );
}

function Selfie({ onNext }: { onNext: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [seconds, setSeconds] = useState<number | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let stream: MediaStream | null = null;
    let gone = false;
    navigator.mediaDevices
      ?.getUserMedia({ video: { facingMode: "user" }, audio: false })
      .then((next) => {
        if (gone) {
          next.getTracks().forEach((track) => track.stop());
          return;
        }
        stream = next;
        if (videoRef.current) videoRef.current.srcObject = next;
      })
      .catch(() => setError("The camera needs permission before a profile can be verified."));
    return () => {
      gone = true;
      stream?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  useEffect(() => {
    if (seconds == null) return undefined;
    if (seconds <= 0) {
      verifySelfie();
      onNext();
      return undefined;
    }
    const timer = window.setTimeout(() => setSeconds((value) => (value == null ? value : value - 1)), 1000);
    return () => window.clearTimeout(timer);
  }, [seconds, onNext]);

  return (
    <div className="space-y-5">
      <Headline text="A live selfie" italic="selfie" />
      <p className="text-mute">Hold still. We capture one frame after five seconds. A liveness vendor checks it later.</p>
      <div className="relative aspect-[3/4] overflow-hidden rounded-3xl border border-line bg-card">
        <video ref={videoRef} autoPlay muted playsInline className="h-full w-full object-cover" />
        {seconds != null ? (
          <div className="absolute inset-0 grid place-items-center bg-ink/40 font-serif text-7xl text-gold">{seconds}</div>
        ) : null}
      </div>
      {error ? <p className="text-sm text-mute">{error}</p> : null}
      <Button disabled={seconds != null} onClick={() => setSeconds(5)}>
        Start 5 second capture
      </Button>
      {error ? (
        <Button variant="ghost" onClick={() => { verifySelfie(); onNext(); }}>
          Demo capture on this device
        </Button>
      ) : null}
    </div>
  );
}

function Photos({
  count,
  main,
  onChange,
  onNext,
}: {
  count: number;
  main: number;
  onChange: (count: number, main: number) => void;
  onNext: () => void;
}) {
  return (
    <div className="space-y-5">
      <Headline text="Real photos, real you." italic="real you." />
      <p className="text-sm text-mute">Add 3 to 6. Filters and AI edits are switched off on profiles.</p>
      <div className="grid grid-cols-3 gap-2">
        {Array.from({ length: 6 }, (_, index) => {
          const filled = index < count;
          return (
            <button
              key={index}
              type="button"
              onClick={() => {
                if (index < count) onChange(count, index);
                else if (count < 6) onChange(count + 1, count === 0 ? 0 : main);
              }}
              className={`relative flex aspect-[3/4] items-end overflow-hidden rounded-2xl border p-2 text-left text-xs ${
                index === main && filled ? "border-gold bg-card2" : "border-line bg-card"
              }`}
            >
              <span className="relative rounded-full bg-ink/80 px-2 py-1 font-semibold">
                {filled ? (index === main ? "Main photo" : "Photo") : "Add photo"}
              </span>
            </button>
          );
        })}
      </div>
      <label className="block text-center text-sm text-mute">
        Or choose from this phone
        <input
          className="mt-2 block w-full text-sm"
          type="file"
          accept="image/*"
          multiple
          onChange={(event) => {
            const added = event.target.files?.length ?? 0;
            onChange(Math.min(6, Math.max(count, added)), main);
          }}
        />
      </label>
      <Button disabled={count < 3} onClick={onNext}>
        Continue
      </Button>
    </div>
  );
}

function Voice({
  voices,
  onChange,
  onNext,
}: {
  voices: Draft["voices"];
  onChange: (voices: Draft["voices"]) => void;
  onNext: () => void;
}) {
  const [active, setActive] = useState<number | null>(null);
  const [seconds, setSeconds] = useState(0);
  const secondsRef = useRef(0);
  const recorder = useRef<MediaRecorder | null>(null);
  secondsRef.current = seconds;

  useEffect(() => {
    if (active == null) return undefined;
    const timer = window.setInterval(() => {
      setSeconds((value) => {
        if (value >= 30) {
          recorder.current?.stop();
          return 30;
        }
        return value + 1;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [active]);

  async function start(index: number) {
    setSeconds(0);
    setActive(index);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const media = new MediaRecorder(stream);
      recorder.current = media;
      media.onstop = () => {
        stream.getTracks().forEach((track) => track.stop());
        const next = voices.map((voice, voiceIndex) =>
          voiceIndex === index ? { ...voice, recorded: true, seconds: Math.max(1, secondsRef.current) } : voice,
        );
        onChange(next);
        setActive(null);
      };
      media.start();
    } catch {
      onChange(voices.map((voice, voiceIndex) => (voiceIndex === index ? { ...voice, recorded: true, seconds: 12 } : voice)));
      setActive(null);
    }
  }

  return (
    <div className="space-y-4">
      <Headline text="Three voices" italic="voices" />
      <p className="text-mute">Up to 30 seconds. You can record again.</p>
      {voices.map((voice, index) => (
        <Card key={voice.prompt}>
          <p className="font-medium">{voice.prompt}</p>
          <p className="mt-1 text-sm text-mute">{voice.recorded ? `${voice.seconds}s saved` : "Not recorded"}</p>
          {active === index ? (
            <div className="mt-3 flex items-end gap-1" aria-hidden>
              {Array.from({ length: 12 }, (_, bar) => (
                <span key={bar} className="w-1.5 rounded-full bg-gold" style={{ height: 8 + ((bar * 7 + seconds) % 24) }} />
              ))}
            </div>
          ) : null}
          <div className="mt-3">
            {active === index ? (
              <Button variant="ghost" onClick={() => recorder.current?.stop()}>
                Stop · {seconds}s
              </Button>
            ) : (
              <Button variant="ghost" onClick={() => start(index)}>
                {voice.recorded ? "Record again" : "Record"}
              </Button>
            )}
          </div>
        </Card>
      ))}
      <Button disabled={voices.some((voice) => !voice.recorded)} onClick={onNext}>
        Continue
      </Button>
    </div>
  );
}

export function Preferences({
  draft,
  onChange,
  onNext,
}: {
  draft: Draft;
  onChange: (patch: Partial<Draft>) => void;
  onNext: () => void;
}) {
  function toggle(list: string[], value: string) {
    return list.includes(value) ? list.filter((item) => item !== value) : [...list, value];
  }
  return (
    <div className="space-y-5">
      <Headline text="Your city" italic="city" />
      <div className="flex flex-wrap gap-2">
        {AREAS.map((area) => (
          <Chip key={area} active={draft.areas.includes(area)} onClick={() => onChange({ areas: toggle(draft.areas, area) })}>
            {area}
          </Chip>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        {LANGUAGES.map((language) => (
          <Chip
            key={language}
            active={draft.languages.includes(language)}
            onClick={() => onChange({ languages: toggle(draft.languages, language) })}
          >
            {language}
          </Chip>
        ))}
      </div>
      <Card>
        <p className="text-sm text-mute">Age range · {draft.ageMin} to {draft.ageMax}</p>
        <input
          className="mt-3 w-full"
          type="range"
          min={18}
          max={70}
          value={draft.ageMin}
          onChange={(event) => onChange({ ageMin: Math.min(Number(event.target.value), draft.ageMax) })}
        />
        <input
          className="w-full"
          type="range"
          min={18}
          max={70}
          value={draft.ageMax}
          onChange={(event) => onChange({ ageMax: Math.max(Number(event.target.value), draft.ageMin) })}
        />
      </Card>
      <div className="flex flex-wrap gap-2">
        {FOODS.map((food) => (
          <Chip key={food} active={draft.foods.includes(food)} onClick={() => onChange({ foods: toggle(draft.foods, food) })}>
            {food}
          </Chip>
        ))}
      </div>
      <Button disabled={draft.areas.length === 0 || draft.languages.length === 0 || draft.foods.length === 0} onClick={onNext}>
        Continue
      </Button>
    </div>
  );
}

function Contacts({
  draft,
  onChange,
  onNext,
}: {
  draft: Draft;
  onChange: (patch: Partial<Draft>) => void;
  onNext: () => void;
}) {
  const [query, setQuery] = useState("");
  const visible = draft.contacts.filter((contact) => contact.name.toLowerCase().includes(query.toLowerCase()));
  const allAllowed = draft.contacts.every((contact) => contact.allowed);
  return (
    <div className="space-y-4">
      <Headline text="Hide from people you know." italic="people you know." />
      <p className="text-sm text-mute">Hide me from all my contacts stays on. The list below is who may still see you.</p>
      <Toggle
        on={draft.hideFromContacts}
        onChange={(hideFromContacts) => onChange({ hideFromContacts })}
        label="Hide me from all my contacts"
        hint="On by default. Numbers are hashed on this phone. The raw list never leaves it."
      />
      <input className={inputClass} placeholder="Search" value={query} onChange={(event) => setQuery(event.target.value)} />
      <button
        type="button"
        className="text-sm font-semibold text-gold"
        onClick={() =>
          onChange({
            contacts: draft.contacts.map((contact) => ({ ...contact, allowed: !allAllowed })),
          })
        }
      >
        {allAllowed ? "Clear allow-list" : "Select all"}
      </button>
      <div className="space-y-2">
        {visible.map((contact) => (
          <label key={contact.phone} className="flex min-h-11 items-center gap-3 rounded-2xl border border-line bg-card px-3">
            <input
              type="checkbox"
              className="h-5 w-5"
              checked={contact.allowed}
              onChange={() =>
                onChange({
                  contacts: draft.contacts.map((item) =>
                    item.phone === contact.phone ? { ...item, allowed: !item.allowed } : item,
                  ),
                })
              }
            />
            <span>
              <span className="block text-sm font-medium">{contact.name}</span>
              <span className="block text-xs text-mute">Allow-list · they can still see you</span>
            </span>
          </label>
        ))}
      </div>
      <Button onClick={onNext}>Save hashes and continue</Button>
    </div>
  );
}

function Ready({ onNext }: { onNext: (notifications: boolean) => void }) {
  return (
    <div className="space-y-6">
      <div className="flex justify-center gap-2">
        <img src={SAMPLE_FACES.sameera} alt="" className="mt-6 h-24 w-16 -rotate-6 rounded-2xl object-cover" />
        <img src={SAMPLE_FACES.ananya} alt="" className="h-32 w-24 rounded-2xl object-cover" />
        <img src={SAMPLE_FACES.divya} alt="" className="mt-6 h-24 w-16 rotate-6 rounded-2xl object-cover" />
      </div>
      <Headline text="Your first Drop arrives at 9 pm." italic="arrives at" className="text-center" />
      <p className="text-center text-mute">3 people, picked for you. Turn on notifications so you don't miss it.</p>
      <Button onClick={() => onNext(true)}>Turn on notifications</Button>
      <Button variant="ghost" onClick={() => onNext(false)}>
        Not now
      </Button>
    </div>
  );
}

export function resetDraft() {
  return emptyDraft();
}
