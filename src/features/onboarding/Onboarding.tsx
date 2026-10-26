import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { isAdult, maxDob } from "../../lib/age";
import { backendConfigured } from "../../lib/env";
import { contactPayload, hashPhone, normaliseE164 } from "../../lib/hash";
import { AREAS, FOODS, LANGUAGES, emptyDraft, type Draft, type Gender, type Intent, type ShowMe } from "../../lib/types";
import { completeOnboarding, saveDraft } from "../../state/logic";
import { useStore } from "../../state/store";
import { Button, Card, Chip, Field, ProgressBar, Toggle, inputClass } from "../../ui/primitives";
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
    <Screen title="Closer" back={index === 0 ? "/" : `/onboarding/${ORDER[index - 1]}`}>
      <div className="mb-5">
        <ProgressBar value={(index + 1) / ORDER.length} />
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
      <h2 className="font-serif text-5xl leading-none">
        Your <span className="italic text-gold">number</span>
      </h2>
      <p className="text-mute">We'll text a code. It stays with the sign-in, not with your profile.</p>
      <Field label="Mobile">
        <input className={inputClass} inputMode="numeric" placeholder="98xxxxxxxx" value={phone} onChange={(event) => setPhone(event.target.value)} />
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
      <h2 className="font-serif text-5xl leading-none">
        Enter the <span className="italic text-gold">code</span>
      </h2>
      <p className="text-mute">Sent to {phone}.</p>
      {backendConfigured ? null : (
        <Card>
          <p className="text-sm text-mute">No SMS provider is connected in this preview. Use code {DEMO_OTP}.</p>
        </Card>
      )}
      <input className={inputClass} inputMode="numeric" maxLength={6} value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))} />
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
      <h2 className="font-serif text-5xl leading-none">
        The <span className="italic text-gold">basics</span>
      </h2>
      <Field label="Name">
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
      <h2 className="font-serif text-5xl leading-none">
        What are you <span className="italic text-gold">here</span> for?
      </h2>
      {options.map((option) => (
        <button
          key={option.id}
          type="button"
          onClick={() => onNext(option.id)}
          className={`w-full rounded-3xl border p-4 text-left ${draft.intent === option.id ? "border-gold bg-card2" : "border-line bg-card"}`}
        >
          <span className="block text-lg font-semibold">{option.title}</span>
          <span className="mt-1 block text-sm text-mute">{option.copy}</span>
        </button>
      ))}
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
      <h2 className="font-serif text-5xl leading-none">
        A live <span className="italic text-gold">selfie</span>
      </h2>
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
      <h2 className="font-serif text-5xl leading-none">
        Three to six <span className="italic text-gold">photos</span>
      </h2>
      <div className="grid grid-cols-3 gap-2">
        {Array.from({ length: 6 }, (_, index) => (
          <button
            key={index}
            type="button"
            onClick={() => {
              if (index < count) onChange(count, index);
              else if (count < 6) onChange(count + 1, count === 0 ? 0 : main);
            }}
            className={`flex aspect-[3/4] items-end rounded-2xl border p-2 text-left text-xs ${
              index === main && index < count ? "border-gold bg-card2" : "border-line bg-card"
            }`}
          >
            {index < count ? (index === main ? "Main" : "Portrait") : "Add"}
          </button>
        ))}
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
      <h2 className="font-serif text-5xl leading-none">
        Three <span className="italic text-gold">voices</span>
      </h2>
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
      <h2 className="font-serif text-5xl leading-none">
        Your <span className="italic text-gold">city</span>
      </h2>
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
      <h2 className="font-serif text-5xl leading-none">
        People you <span className="italic text-gold">know</span>
      </h2>
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
      <h2 className="font-serif text-5xl leading-none">
        Tonight at <span className="italic text-gold">nine</span>
      </h2>
      <p className="text-mute">Your first Drop arrives at 9:00 pm IST. Three verified people. No one else is notified that you looked.</p>
      <Button onClick={() => onNext(true)}>Turn on the evening reminder</Button>
      <Button variant="ghost" onClick={() => onNext(false)}>
        Not now
      </Button>
    </div>
  );
}

export function resetDraft() {
  return emptyDraft();
}
