import { Coffee, Gift, Hand, Mic, Plus, Timer, Volume2, VolumeX } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { PEOPLE } from "../../mocks/people";
import { env } from "../../lib/env";
import { createRoom, spendCoins } from "../../state/logic";
import { likePerson, recordStreak } from "../../state/live";
import { useStore } from "../../state/store";
import { Button, Card, Headline, Sheet, inputClass } from "../../ui/primitives";
import { SELF_PHOTOS, samplePhoto } from "../../ui/photos";
import { Screen } from "../../ui/shell";
import { Portrait } from "../../ui/visuals";

const GIFTS = [
  { id: "chai", label: "Chai", cost: 20 },
  { id: "jasmine", label: "Jasmine", cost: 40 },
  { id: "marigold", label: "Marigold", cost: 10 },
];

const TOPICS = [
  "The café you take someone to first",
  "A film you will defend",
  "What Sunday should sound like",
  "A green flag you trust",
];

export function RoomsHome() {
  const { state } = useStore();
  const navigate = useNavigate();
  const live = state.rooms.filter((room) => room.live && !state.endedRooms.includes(room.id));
  const later = state.rooms.filter((room) => !room.live && !state.endedRooms.includes(room.id));
  return (
    <Screen tab>
      <Headline text="Rooms live now" italic="live" />
      <p className="mt-2 text-sm text-mute">Voice first. Names stay optional.</p>
      <button type="button" onClick={() => navigate("/rooms/chai")} className="mt-4 w-full rounded-3xl border border-gold/50 bg-card p-4 text-left">
        <span className="flex items-center gap-2 text-xs uppercase tracking-[0.16em] text-gold"><Coffee size={14} /> Chai Break</span>
        <span className="mt-2 block font-serif text-3xl">Five anonymous minutes</span>
        <span className="mt-1 block text-sm text-mute">Matched on intent and language. Names stay hidden unless you both reveal.</span>
      </button>
      <h3 className="mb-3 mt-6 flex items-center gap-2 text-sm text-mute"><Mic size={14} /> Live now</h3>
      <div className="space-y-3">
        {live.map((room) => (
          <button key={room.id} type="button" onClick={() => navigate(`/rooms/${room.id}`)} className="flex min-h-11 w-full items-center gap-3 rounded-3xl border border-line bg-card p-4 text-left">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-mint/15 text-mint"><Mic size={18} /></span>
            <span className="min-w-0 flex-1">
              <span className="block font-semibold">{room.title}</span>
              <span className="mt-1 block text-sm text-mute">{room.speakers} speaking · {room.listeners} listening · {room.host}</span>
            </span>
          </button>
        ))}
      </div>
      <h3 className="mb-3 mt-6 text-sm text-mute">Later</h3>
      {later.map((room) => (
        <p key={room.id} className="flex min-h-11 items-center rounded-2xl border border-line px-4 py-3 text-sm">{room.title} · {room.scheduled}</p>
      ))}
      <div className="mt-5">
        <Button variant="ghost" onClick={() => navigate("/rooms/new")}><Plus size={18} /> Create a room</Button>
      </div>
    </Screen>
  );
}

export function CreateRoom() {
  const { current, commit } = useStore();
  const navigate = useNavigate();
  const [title, setTitle] = useState("");
  const [topic, setTopic] = useState("");
  return (
    <Screen title="New room" back="/rooms">
      <Headline text="Start a room" italic="room" />
      <p className="mt-2 text-sm text-mute">A title is enough. The topic can wait.</p>
      <div className="mt-4 space-y-3">
        <input className={inputClass} placeholder="Title" value={title} onChange={(event) => setTitle(event.target.value)} />
        <input className={inputClass} placeholder="Topic" value={topic} onChange={(event) => setTopic(event.target.value)} />
        <Button
          disabled={title.trim().length < 3}
          onClick={() => {
            const id = `room_${Date.now()}`;
            commit(createRoom(current(), { id, title: title.trim(), topic: topic.trim() || "Open conversation", host: "You", scheduled: null }));
            navigate(`/rooms/${id}`);
          }}
        >
          Open room
        </Button>
      </div>
    </Screen>
  );
}

export function LiveRoom() {
  const { id = "" } = useParams();
  const { state, current, commit } = useStore();
  const navigate = useNavigate();
  const room = state.rooms.find((item) => item.id === id);
  const [muted, setMuted] = useState(false);
  const [hand, setHand] = useState(false);
  const [gifts, setGifts] = useState(false);
  const [note, setNote] = useState("");
  const [tokenNote, setTokenNote] = useState("");
  useEffect(() => {
    let cancelled = false;
    async function connect() {
      if (!env.livekitUrl) {
        setTokenNote("Voice connects when a LiveKit URL is set. This room is the preview.");
        return;
      }
      const { Room } = await import("livekit-client");
      if (cancelled) return;
      setTokenNote(`Ready for ${Room.name ? "LiveKit" : "voice"}. Token comes from the edge function.`);
    }
    void connect();
    return () => {
      cancelled = true;
    };
  }, []);
  if (!room || state.endedRooms.includes(room.id)) {
    return <Screen title="Room" back="/rooms"><p>This room has ended.</p></Screen>;
  }
  const speakers = ["Imran", "Laya", "Meher"].filter((name) => name !== room.host).slice(0, 2);
  const seats = [
    { name: room.host, role: "Host", photo: samplePhoto(state.preview, room.host.toLowerCase()) },
    ...speakers.map((name) => ({ name, role: "Speaker", photo: samplePhoto(state.preview, name.toLowerCase()) })),
    { name: "You", role: hand ? "Hand raised" : "Listener", photo: state.preview ? SELF_PHOTOS[0] : undefined },
  ];
  return (
    <Screen title={room.title} back="/rooms" tab>
      {room.ai ? <p className="mb-3 inline-flex rounded-full bg-mint/15 px-3 py-1 text-xs font-semibold text-mint">AI moderation on in this room</p> : null}
      <p className="text-sm text-mute">{room.topic}</p>
      <p className="mt-2 text-xs text-mute">{tokenNote}</p>
      <div className="mt-4 grid grid-cols-2 gap-3">
        {seats.map((seat) => (
          <Card key={seat.name}>
            <Portrait name={seat.name} palette={["#3A2A48", "#FFB547"]} src={state.displayMode === "photo" ? seat.photo : undefined} className="h-24 w-full rounded-2xl" mode={state.displayMode} />
            <p className="mt-2 font-semibold">{state.discreet ? "Guest" : seat.name}</p>
            <p className="text-xs text-mute">{seat.role}</p>
          </Card>
        ))}
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2">
        <Button variant="ghost" onClick={() => setMuted((value) => !value)}>{muted ? <VolumeX size={18} /> : <Volume2 size={18} />}{muted ? "Unmute" : "Mute"}</Button>
        <Button variant="ghost" onClick={() => setHand((value) => !value)}><Hand size={18} />{hand ? "Lower hand" : "Raise hand"}</Button>
        <Button variant="ghost" onClick={() => setGifts(true)}><Gift size={18} /> Gift</Button>
        <Button variant="ghost" onClick={() => navigate("/rooms")}>Leave</Button>
      </div>
      {note ? <p className="mt-3 text-sm text-mint">{note}</p> : null}
      <Sheet open={gifts} title="Send a gift" onClose={() => setGifts(false)}>
        <p className="text-sm text-mute">{state.coins} coins. The ledger lives on the server. Nothing here is a bet.</p>
        <div className="mt-4 space-y-2">
          {GIFTS.map((gift) => (
            <Button
              key={gift.id}
              variant="ghost"
              onClick={() => {
                const result = spendCoins(current(), gift.cost, gift.id);
                commit(result.state);
                setNote(result.ok ? `${gift.label} sent.` : "Not enough coins.");
                setGifts(false);
              }}
            >
              <Gift size={16} /> {gift.label} · {gift.cost} coins
            </Button>
          ))}
        </div>
      </Sheet>
    </Screen>
  );
}

export function ChaiBreak() {
  const { state, current, commit } = useStore();
  const navigate = useNavigate();
  const [phase, setPhase] = useState<"queue" | "live" | "end">("queue");
  const [left, setLeft] = useState(300);
  const [topic, setTopic] = useState(0);
  const [mine, setMine] = useState(false);
  const [theirs] = useState(() => Math.random() > 0.45);
  const partner = PEOPLE.find((person) => person.verified && person.intent !== "friends") ?? PEOPLE[0];
  useEffect(() => {
    if (phase !== "queue") return undefined;
    const timer = window.setTimeout(() => setPhase("live"), 1600);
    return () => window.clearTimeout(timer);
  }, [phase]);
  useEffect(() => {
    if (phase !== "live") return undefined;
    const timer = window.setInterval(() => {
      setLeft((value) => {
        if (value <= 1) {
          setPhase("end");
          return 0;
        }
        return value - 1;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [phase]);
  const clock = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, "0")}`;
  const revealed = mine && theirs && phase !== "queue";
  return (
    <Screen title="Chai Break" back="/rooms">
      {phase === "queue" ? (
        <div>
          <div className="grid h-28 w-28 place-items-center rounded-full border border-gold/40 bg-card">
            <Coffee size={28} className="text-gold" />
          </div>
          <Headline text="Finding a voice" italic="voice" className="mt-5" />
          <p className="mt-3 text-sm text-mute">Intent and language only. No photo yet.</p>
        </div>
      ) : null}
      {phase === "live" ? (
        <div className="space-y-4">
          <p className="flex items-center gap-2 text-sm text-mute"><Timer size={16} /> Five minutes</p>
          <p className="font-serif text-6xl">{clock}</p>
          <div className="flex items-center gap-3">
            <Portrait
              name={revealed ? partner.name : "Guest"}
              palette={partner.palette}
              src={revealed ? samplePhoto(state.preview, partner.id) : undefined}
              mode={revealed && state.preview ? "photo" : "initials"}
              className="h-16 w-16 rounded-full"
              compact
            />
            <p className="text-sm text-mute">{revealed ? partner.name : "Initials only, until you both reveal"}</p>
          </div>
          <Card>
            <p className="text-xs text-mute">Topic</p>
            <p className="mt-1 text-lg">{TOPICS[topic % TOPICS.length]}</p>
            <button type="button" className="mt-3 inline-flex min-h-11 items-center text-sm font-semibold text-gold" onClick={() => setTopic((value) => value + 1)}>Another card</button>
          </Card>
          <Button onClick={() => setMine(true)}>{mine ? "You revealed" : "Reveal"}</Button>
        </div>
      ) : null}
      {phase === "end" || (mine && phase === "live") ? (
        <Card className="mt-4">
          {mine && theirs ? (
            <>
              <Portrait
                name={partner.name}
                palette={partner.palette}
                src={samplePhoto(state.preview, partner.id)}
                className="mb-3 h-24 w-20 rounded-2xl"
              />
              <p className="font-semibold">You both revealed. This is {partner.name}.</p>
              <div className="mt-3">
                <Button onClick={() => {
                  void recordStreak(current(), "room");
                  void likePerson(current(), partner.id, "From Chai Break", []).then((result) => {
                    commit(result.state);
                    navigate(result.matched ? `/match/${partner.id}` : "/rooms");
                  });
                }}>
                  Send a like
                </Button>
              </div>
            </>
          ) : mine ? (
            <p>They kept it anonymous. That's a complete conversation too.</p>
          ) : phase === "end" ? (
            <p>Time's up. You both stayed unnamed, and the call ended politely.</p>
          ) : null}
          {phase === "end" && !(mine && theirs) ? (
            <div className="mt-3"><Button variant="ghost" onClick={() => navigate("/rooms")}>Back to rooms</Button></div>
          ) : null}
        </Card>
      ) : null}
      <p className="mt-4 text-xs text-mute">Coins on your account: {state.coins}. Gifts are not stakes.</p>
    </Screen>
  );
}
