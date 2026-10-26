import { Link, NavLink, Outlet, useSearchParams } from "react-router-dom";
import { VENUES } from "../../mocks/catalog";
import { adminAct, endRoom, setRole } from "../../state/logic";
import { useStore } from "../../state/store";
import { canSeeAddress, canSeeFees } from "../safety/api";
import type { AdminRole } from "../../lib/types";

const ROLES: AdminRole[] = ["safety", "ops", "finance"];

export function AdminApp() {
  const { state, current, commit } = useStore();
  return (
    <div className="min-h-dvh bg-ink text-cream">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-6 py-4">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-mute">Closer staff · 2026</p>
          <h1 className="font-serif text-3xl">Desk</h1>
        </div>
        <div className="flex gap-2">
          {ROLES.map((role) => (
            <button key={role} type="button" onClick={() => commit(setRole(current(), role))} className={`rounded-full px-3 py-1 text-sm ${state.adminRole === role ? "bg-gold text-ink" : "border border-line"}`}>
              {role}
            </button>
          ))}
        </div>
      </header>
      <div className="grid min-h-[calc(100dvh-88px)] md:grid-cols-[220px_1fr]">
        <nav className="flex gap-2 overflow-auto border-b border-line p-4 md:flex-col md:border-b-0 md:border-r">
          {[
            ["/admin", "Reports"],
            ["/admin/dates", "Date safety"],
            ["/admin/venues", "Venues"],
            ["/admin/rooms", "Rooms"],
            ["/admin/growth", "Growth"],
          ].map(([path, label]) => (
            <NavLink key={path} to={path} end={path === "/admin"} className={({ isActive }) => `rounded-2xl px-3 py-2 text-sm ${isActive ? "bg-card text-gold" : "text-mute"}`}>
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="p-6">
          <Outlet />
          <h2 className="mb-2 mt-8 text-sm text-mute">Audit</h2>
          <ul className="space-y-1 text-sm">
            {state.audit.slice(0, 8).map((entry) => (
              <li key={entry.id}>{entry.role} · {entry.action} · {entry.detail}</li>
            ))}
            {state.audit.length === 0 ? <li className="text-mute">No staff actions yet.</li> : null}
          </ul>
        </div>
      </div>
    </div>
  );
}

export function Reports() {
  const { state, current, commit } = useStore();
  const [params] = useSearchParams();
  const focus = params.get("focus");
  const open = state.reports.filter((report) => report.status === "open");
  const selected = state.reports.find((report) => report.id === focus) ?? open[0] ?? state.reports[0];
  return (
    <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
      <div className="space-y-2">
        {state.reports.map((report) => (
          <Link key={report.id} to={`/admin?focus=${report.id}`} className={`block rounded-2xl border p-3 ${selected?.id === report.id ? "border-gold" : "border-line"}`}>
            <span className="block font-semibold">{report.againstName}</span>
            <span className="text-xs text-mute">{report.category} · {report.status}{report.sample ? " · sample" : ""}</span>
          </Link>
        ))}
      </div>
      {selected ? (
        <article className="rounded-3xl border border-line bg-card p-4">
          <p className="text-xs text-mute">{new Date(selected.at).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}</p>
          <h2 className="mt-1 font-serif text-3xl">{selected.againstName}</h2>
          <p className="text-sm text-coral">{selected.category}</p>
          <p className="mt-3 text-sm">{selected.detail}</p>
          <div className="mt-3 space-y-2">
            {selected.evidence.map((line) => (
              <p key={line} className="rounded-2xl bg-ink px-3 py-2 text-sm">{line}</p>
            ))}
          </div>
          {selected.status === "open" ? (
            <div className="mt-4 flex flex-wrap gap-2">
              <button type="button" className="rounded-2xl bg-gold px-3 py-2 text-sm font-semibold text-ink" onClick={() => commit(adminAct(current(), selected.id, "confirm").state)}>Confirm</button>
              <button type="button" className="rounded-2xl border border-line px-3 py-2 text-sm" onClick={() => commit(adminAct(current(), selected.id, "dismiss").state)}>Dismiss</button>
              <button type="button" className="rounded-2xl border border-coral px-3 py-2 text-sm text-coral" onClick={() => commit(adminAct(current(), selected.id, "ban").state)}>Ban</button>
              <button type="button" className="rounded-2xl border border-line px-3 py-2 text-sm" onClick={() => commit(adminAct(current(), selected.id, "escalate").state)}>Escalate</button>
            </div>
          ) : (
            <p className="mt-4 text-sm text-mint">Closed as {selected.status}.</p>
          )}
          {state.adminRole !== "safety" ? <p className="mt-2 text-xs text-mute">Confirm and ban stay with the safety role.</p> : null}
        </article>
      ) : null}
    </div>
  );
}

export function Dates() {
  const { state } = useStore();
  const missed = state.sessions.filter((session) => session.promptAt && !session.answeredAt && Date.now() - Date.parse(session.promptAt) > 5 * 60 * 1000);
  return (
    <div>
      <h2 className="font-serif text-3xl">Live dates</h2>
      {state.sessions.length === 0 ? <p className="mt-3 text-sm text-mute">No one is checked in.</p> : null}
      <div className="mt-4 space-y-3">
        {state.sessions.map((session) => {
          const late = missed.some((item) => item.planId === session.planId);
          return (
            <article key={session.planId} className={`rounded-3xl border p-4 ${late ? "border-coral" : "border-line"}`}>
              <p className="font-semibold">{late ? "Missed check-in" : "Checked in"} · {session.planId}</p>
              <p className="text-sm text-mute">Sharing {session.sharing ? "on" : "off"} · call {session.callPlaced ? "placed" : "not yet"}</p>
              <div className="mt-3 flex flex-wrap gap-2 text-sm">
                <a className="rounded-full border border-line px-3 py-1" href="tel:+919000000111">Call user</a>
                <a className="rounded-full border border-line px-3 py-1" href="tel:+919000000010">Call contact</a>
                <span className="rounded-full border border-line px-3 py-1">Guide them to a lit public place and to 112 if they are in danger</span>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}

export function Venues() {
  const { state } = useStore();
  const fees = canSeeFees(state.adminRole);
  return (
    <div>
      <h2 className="font-serif text-3xl">Partner cafés</h2>
      <div className="mt-4 overflow-auto">
        <table className="w-full text-left text-sm">
          <thead className="text-mute">
            <tr><th className="py-2">Venue</th><th>Check-ins</th><th>Fees due</th></tr>
          </thead>
          <tbody>
            {VENUES.map((venue) => (
              <tr key={venue.id} className="border-t border-line">
                <td className="py-3">{venue.name}<span className="block text-xs text-mute">{venue.area}</span></td>
                <td>{venue.checkIns}</td>
                <td>{fees ? `₹${venue.feeDue}` : "Finance"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function RoomsMonitor() {
  const { state, current, commit } = useStore();
  return (
    <div className="space-y-3">
      <h2 className="font-serif text-3xl">Rooms</h2>
      {state.rooms.map((room) => (
        <article key={room.id} className="rounded-3xl border border-line p-4">
          <p className="font-semibold">{room.title}</p>
          <p className="text-sm text-mute">{room.listeners + room.speakers} in the room {room.flag ? `· flag: ${room.flag}` : ""}</p>
          {state.endedRooms.includes(room.id) ? <p className="text-sm text-mint">Ended</p> : (
            <button type="button" className="mt-2 text-sm font-semibold text-coral" onClick={() => commit(endRoom(current(), room.id))}>End room</button>
          )}
        </article>
      ))}
    </div>
  );
}

export function Growth() {
  const { state } = useStore();
  const stats = [
    ["Drop opens", "1,284"],
    ["Active streaks", "640"],
    ["Dates checked in", "86"],
    ["Women's day-30 retention", "41%"],
  ];
  return (
    <div>
      <h2 className="font-serif text-3xl">Growth</h2>
      <p className="mt-2 text-sm text-mute">Day-30 retention counts women still opening the app 30 days after verification.</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {stats.map(([label, value]) => (
          <article key={label} className="rounded-3xl border border-line bg-card p-4">
            <p className="text-sm text-mute">{label}</p>
            <p className="font-serif text-4xl">{value}</p>
          </article>
        ))}
      </div>
      {canSeeAddress(state.adminRole) && state.giftClaim ? (
        <p className="mt-4 text-sm">Fulfilment address: {state.giftClaim.address}</p>
      ) : (
        <p className="mt-4 text-sm text-mute">Gift addresses stay with finance.</p>
      )}
    </div>
  );
}
