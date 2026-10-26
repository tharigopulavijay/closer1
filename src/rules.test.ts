import { CreateGameReducer, InitializeGame } from "boardgame.io/internal";
import { describe, expect, it } from "vitest";
import { isAdult } from "./lib/age";
import { contactPayload, normaliseE164 } from "./lib/hash";
import { currentDropDate, istDate, nextDropAt } from "./lib/time";
import { PEOPLE } from "./mocks/people";
import { previewPrefs, recordActivity, selectDrop, type Prefs } from "./features/drop/api";
import { canCreatePlan, chatIsOpen } from "./features/plans/api";
import { claimOk, createTicket } from "./features/play/housie";
import { COLOURS, CloserLudo, createLudo, move, roll } from "./features/play/ludo";
import {
  canConfirmStrike,
  canSeeAddress,
  escalationStage,
  moderateMessage,
  withinGeofence,
} from "./features/safety/api";
import { adminAct, blankState, bookPlan, sendMessage, setRole } from "./state/logic";
import type { Person, Plan, Streak } from "./lib/types";

const NOW = new Date("2026-10-26T08:00:00.000Z");

const prefs: Prefs = {
  ...previewPrefs(),
  areas: [],
  foods: ["Anything"],
};

describe("time and age", () => {
  it("counts the next 9pm IST drop", () => {
    expect(nextDropAt(NOW).toISOString()).toBe("2026-10-26T15:30:00.000Z");
    expect(currentDropDate(NOW)).toBe("2026-10-25");
    expect(istDate(new Date("2026-10-26T15:30:00.000Z"))).toBe("2026-10-26");
  });

  it("requires 18 years in India", () => {
    expect(isAdult("2008-10-26", NOW)).toBe(true);
    expect(isAdult("2008-10-27", NOW)).toBe(false);
    expect(isAdult("2010-01-01", NOW)).toBe(false);
  });
});

describe("contacts", () => {
  it("hashes on device and never returns the raw number", async () => {
    expect(normaliseE164("9000000099")).toBe("+919000000099");
    const payload = await contactPayload([
      { name: "Amma", phone: "9000000099", allowed: false },
      { name: "Kabir", phone: "9000000004", allowed: true },
    ]);
    const encoded = JSON.stringify(payload);
    expect(encoded).not.toContain("9000000099");
    expect(encoded).not.toContain("9000000004");
    expect(payload.hashes).toHaveLength(2);
    expect(payload.allowlist).toHaveLength(1);
    expect(payload.hashes[0]).toHaveLength(64);
  });
});

describe("drop", () => {
  it("hides unverified, blocked, and contact-hidden people", () => {
    const hidden: Person = {
      ...PEOPLE[0],
      id: "hidden-person",
      hideFromContacts: true,
      contactHashes: ["abc"],
      allowHashes: [],
      verified: true,
    };
    const picks = selectDrop(PEOPLE, prefs, "2026-10-25", {
      viewerHash: "viewer",
      blocked: ["imran"],
      banned: [],
      now: NOW,
      away: false,
      paused: false,
    });
    expect(picks).toHaveLength(3);
    expect(picks.some((person) => person.id === "unverified")).toBe(false);
    expect(picks.some((person) => person.id === "imran")).toBe(false);
    expect(
      selectDrop([hidden], prefs, "2026-10-25", {
        viewerHash: "abc",
        blocked: [],
        banned: [],
        now: NOW,
        away: false,
        paused: false,
      }),
    ).toHaveLength(0);
    expect(
      selectDrop([{ ...hidden, allowHashes: ["abc"] }], prefs, "2026-10-25", {
        viewerHash: "abc",
        blocked: [],
        banned: [],
        now: NOW,
        away: false,
        paused: false,
      }),
    ).toHaveLength(1);
  });

  it("pauses for away mode and keeps a streak freeze honest", () => {
    expect(
      selectDrop(PEOPLE, prefs, "2026-10-25", {
        viewerHash: "",
        blocked: [],
        banned: [],
        now: NOW,
        away: true,
        paused: false,
      }),
    ).toHaveLength(0);
    const streak: Streak = {
      count: 23,
      lastDate: "2026-10-24",
      freezesLeft: 2,
      freezeMonth: "2026-10",
      frozenByAway: false,
      giftsClaimed: [],
    };
    const missed = recordActivity(streak, NOW, false);
    expect(missed.streak.count).toBe(1);
    const frozen = recordActivity({ ...streak, frozenByAway: true }, NOW, true);
    expect(frozen.streak.count).toBe(23);
  });
});

describe("plans, chat, safety", () => {
  it("caps open plans and closes chat after 48 hours", () => {
    const plan = (id: string): Plan => ({
      id,
      personId: "meher",
      venueId: "heartcup",
      slot: "Sat · 8:00 pm",
      kind: "coffee",
      status: "upcoming",
      deposit: "paid",
      bookedAt: NOW.toISOString(),
      createdAt: NOW.toISOString(),
      keptByMe: false,
      keptByThem: false,
      closedKindly: false,
    });
    expect(canCreatePlan([plan("a"), plan("b"), plan("c")], false)).toBe(false);
    expect(canCreatePlan([plan("a"), plan("b"), plan("c")], true)).toBe(true);
    const booked = plan("d");
    expect(chatIsOpen(booked, NOW.getTime() + 47 * 3600 * 1000)).toBe(true);
    expect(chatIsOpen(booked, NOW.getTime() + 49 * 3600 * 1000)).toBe(false);
    expect(chatIsOpen({ ...booked, keptByMe: true, keptByThem: true }, NOW.getTime() + 49 * 3600 * 1000)).toBe(true);
  });

  it("stops a money request before delivery and keeps strikes with safety", () => {
    const sent = sendMessage(blankState(NOW), "missing", "want to get Irani chai?");
    expect(sent.status).toBe("blocked");
    const state = blankState(NOW);
    const planId = "p1";
    const withPlan = {
      ...state,
      plans: [
        {
          id: planId,
          personId: "meher",
          venueId: "heartcup",
          slot: "Sat · 8:00 pm",
          kind: "coffee" as const,
          status: "upcoming" as const,
          deposit: "paid" as const,
          bookedAt: NOW.toISOString(),
          createdAt: NOW.toISOString(),
          keptByMe: false,
          keptByThem: false,
          closedKindly: false,
        },
      ],
    };
    const blocked = sendMessage(withPlan, planId, "send me your gpay and I'll book it");
    expect(blocked.status).toBe("blocked");
    expect(blocked.rule).toBe("Money request");
    expect(blocked.state.messages[planId]).toBeUndefined();
    expect(moderateMessage("you are kind")).toEqual({ severity: "ok", rule: "" });
    expect(canConfirmStrike("ops")).toBe(false);
    expect(canSeeAddress("finance")).toBe(true);
    expect(canSeeAddress("safety")).toBe(false);
    const ops = adminAct(setRole(blocked.state, "ops"), blocked.state.reports[0].id, "confirm", NOW);
    expect(ops.error).toMatch(/safety/);
    const safety = adminAct(blocked.state, blocked.state.reports[0].id, "confirm", NOW);
    expect(safety.error).toBe("");
    expect(safety.state.bans).toContain("You");
  });

  it("measures the venue geofence and the check-in ladder", () => {
    const venue = { lat: 17.4318, lng: 78.4074 };
    expect(withinGeofence(venue, venue)).toBe(true);
    expect(withinGeofence({ lat: 17.45, lng: 78.45 }, venue)).toBe(false);
    expect(escalationStage(4 * 60 * 1000, false, false)).toBe("waiting");
    expect(escalationStage(5 * 60 * 1000, false, false)).toBe("calling");
    expect(escalationStage(6 * 60 * 1000, false, false)).toBe("alerted");
    expect(escalationStage(6 * 60 * 1000, true, false)).toBe("ok");
  });
});

describe("ludo and housie", () => {
  it("uses four distinct colours and standard movement", () => {
    expect(new Set(COLOURS.map((colour) => colour.hex)).size).toBe(4);
    let state = roll(createLudo(4), 5);
    expect(state.tokens.every((row) => row.every((token) => token.where === "yard"))).toBe(true);
    state = roll(createLudo(4), 6);
    state = move(state, 0);
    expect(state.tokens[0][0]).toEqual({ where: "track", index: 39 });
    state = roll(state, 6);
    state = move(state, 0);
    state = roll(state, 6);
    expect(state.current).toBe(1);
    let finish = createLudo(2);
    finish = {
      ...finish,
      phase: "move",
      dice: 1,
      tokens: finish.tokens.map((row, player) =>
        row.map((token, index) => {
          if (player !== 0) return token;
          if (index === 0) return { where: "home", step: 4 };
          return { where: "done" };
        }),
      ),
    };
    finish = move(finish, 0);
    expect(finish.winner).toBe(0);
  });

  it("captures off a safe square and leaves a safe square alone", () => {
    let state = roll(createLudo(4), 6);
    state = move(state, 0);
    state = {
      ...state,
      tokens: state.tokens.map((row, player) =>
        player === 1 ? [{ where: "track", index: 40 }, row[1], row[2], row[3]] : row,
      ),
    };
    state = roll(state, 1);
    state = move(state, 0);
    expect(state.lastCapture).toBe(true);
    expect(state.tokens[1][0]).toEqual({ where: "yard" });

    let safe = createLudo(4);
    safe = {
      ...safe,
      tokens: safe.tokens.map((row, player) =>
        player === 1 ? [{ where: "track", index: 39 }, row[1], row[2], row[3]] : row,
      ),
    };
    safe = roll(safe, 6);
    safe = move(safe, 0);
    expect(safe.lastCapture).toBe(false);
    expect(safe.tokens[1][0]).toEqual({ where: "track", index: 39 });
  });

  it("runs a roll through boardgame.io", () => {
    const reducer = CreateGameReducer({ game: CloserLudo });
    const start = InitializeGame({ game: CloserLudo, numPlayers: 4 });
    const next = reducer(start, {
      type: "MAKE_MOVE",
      payload: { type: "rollDice", args: [], playerID: "0" },
    });
    expect(next.G.players).toBe(4);
    const stayed = next.G.current === 0 && next.G.dice === 6 && next.G.phase === "move";
    const passed = next.G.current === 1 && next.G.phase === "roll";
    expect(stayed || passed).toBe(true);
  });

  it("builds a housie ticket and checks a claim", () => {
    const ticket = createTicket(26);
    expect(ticket).toHaveLength(3);
    for (const row of ticket) {
      expect(row.filter((value) => value != null)).toHaveLength(5);
    }
    const numbers = ticket.flat().filter((value): value is number => value != null);
    expect(new Set(numbers).size).toBe(15);
    for (let col = 0; col < 9; col += 1) {
      const column = ticket.map((row) => row[col]).filter((value): value is number => value != null);
      const start = col === 0 ? 1 : col * 10;
      const end = col === 8 ? 90 : col * 10 + 9;
      expect(column.every((value) => value >= start && value <= end)).toBe(true);
      expect([...column].sort((a, b) => a - b)).toEqual(column);
    }
    expect(claimOk(ticket, numbers.slice(0, 5), "early")).toBe(true);
    expect(claimOk(ticket, numbers.slice(0, 4), "early")).toBe(false);
    expect(claimOk(ticket, numbers, "full")).toBe(true);
  });
});

describe("booking guard", () => {
  it("refuses a fourth open plan", () => {
    let state = blankState(NOW);
    state = { ...state, matches: ["meher", "karthik", "ananya", "laya"], plus: null };
    const kinds = ["coffee", "walk", "dinner", "gallery"] as const;
    const people = ["meher", "karthik", "ananya", "laya"];
    people.forEach((personId, index) => {
      const result = bookPlan(state, {
        personId,
        venueId: "heartcup",
        slot: "Sat · 8:00 pm",
        kind: kinds[index],
      });
      state = result.state;
    });
    expect(state.plans.filter((plan) => plan.status === "upcoming")).toHaveLength(3);
  });
});
