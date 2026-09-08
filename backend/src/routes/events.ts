import { Router } from "express";
import { asyncHandler } from "../asyncHandler.js";
import { requireAuth } from "../auth.js";
import { db, orThrow } from "../db.js";
import { badRequest, conflict, notFound } from "../errors.js";
import { parseId, parseText, requireJsonBody } from "../http.js";
import { loadPeople, type PublicUser } from "../people.js";

const SLOT_COLUMNS = "id, owner_id, title, capacity, created_at";
const MAX_TITLE_LENGTH = 200;
const MAX_CAPACITY = 500;

type SlotRow = {
  id: number;
  owner_id: number;
  title: string;
  capacity: number;
  created_at: string;
};

type SignupRow = { slot_id: number; user_id: number };

const parseTitle = (raw: unknown) => parseText(raw, "title", MAX_TITLE_LENGTH);

function parseCapacity(raw: unknown): number {
  if (typeof raw !== "number" || !Number.isInteger(raw)) {
    throw badRequest("capacity must be a whole number.");
  }
  if (raw < 1 || raw > MAX_CAPACITY) {
    throw badRequest(`capacity must be between 1 and ${MAX_CAPACITY}.`);
  }
  return raw;
}

/** One query for every slot's signups, the same trick loadPeople uses for
 *  users: rendering a page of events is two queries, not one per event. */
async function decorate(
  slots: SlotRow[],
  viewerId: number,
  people: Map<number, PublicUser>,
) {
  if (slots.length === 0) {
    return [];
  }

  const signups = orThrow(
    await db
      .from("signups")
      .select("slot_id, user_id")
      .in(
        "slot_id",
        slots.map((slot) => slot.id),
      )
      .returns<SignupRow[]>(),
  );

  const takenBySlot = new Map<number, number>();
  const joinedSlots = new Set<number>();
  for (const signup of signups) {
    takenBySlot.set(signup.slot_id, (takenBySlot.get(signup.slot_id) ?? 0) + 1);
    if (signup.user_id === viewerId) {
      joinedSlots.add(signup.slot_id);
    }
  }

  return slots.map((slot) => {
    const taken = takenBySlot.get(slot.id) ?? 0;
    return {
      id: slot.id,
      title: slot.title,
      capacity: slot.capacity,
      taken,
      full: taken >= slot.capacity,
      joined: joinedSlots.has(slot.id),
      owner: people.get(slot.owner_id) ?? null,
      mine: slot.owner_id === viewerId,
      createdAt: new Date(slot.created_at).toISOString(),
    };
  });
}

export const eventsRouter = Router();

eventsRouter.use(asyncHandler(requireAuth));

// Everyone sees every event, like the message board: an event nobody but its
// owner can see is not much of an event.
eventsRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const slots = orThrow(
      await db
        .from("event_slots")
        .select(SLOT_COLUMNS)
        .order("created_at", { ascending: false })
        .order("id", { ascending: false })
        .returns<SlotRow[]>(),
    );

    const people = await loadPeople(slots.map((slot) => slot.owner_id));
    res.json({ items: await decorate(slots, req.user!.id, people) });
  }),
);

eventsRouter.post(
  "/",
  requireJsonBody,
  asyncHandler(async (req, res) => {
    const row = orThrow(
      await db
        .from("event_slots")
        .insert({
          owner_id: req.user!.id,
          title: parseTitle(req.body?.title),
          capacity: parseCapacity(req.body?.capacity),
        })
        .select(SLOT_COLUMNS)
        .single<SlotRow>(),
    );

    const people = await loadPeople([row.owner_id]);
    res.status(201).json((await decorate([row], req.user!.id, people))[0]);
  }),
);

eventsRouter.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    const id = parseId(req.params.id);

    // Closing the sign-up sheet is the owner's call, not the seat-holders'.
    // The cascade on signups.slot_id clears their seats along with it.
    const rows = orThrow(
      await db
        .from("event_slots")
        .delete()
        .eq("id", id)
        .eq("owner_id", req.user!.id)
        .select("id")
        .returns<{ id: number }[]>(),
    );

    if (rows.length === 0) {
      throw notFound(`No event of yours with id ${id}.`);
    }
    res.status(204).end();
  }),
);

/** The one endpoint here with a race in it on purpose. Two people can both
 *  read "1 spot left" and both press join: whoever's insert lands first
 *  wins, the other gets 409 "full" rather than a ninth person in an
 *  eight-seat room. That 409 is the frontend's cue to undo an optimistic
 *  "you're in" rather than trust the click that caused it. */
eventsRouter.post(
  "/:id/join",
  asyncHandler(async (req, res) => {
    const id = parseId(req.params.id);
    const userId = req.user!.id;

    const slots = orThrow(
      await db
        .from("event_slots")
        .select(SLOT_COLUMNS)
        .eq("id", id)
        .returns<SlotRow[]>(),
    );
    const slot = slots[0];
    if (!slot) {
      throw notFound(`No event with id ${id}.`);
    }

    const existing = orThrow(
      await db
        .from("signups")
        .select("id")
        .eq("slot_id", id)
        .returns<{ id: number }[]>(),
    );
    if (existing.length >= slot.capacity) {
      throw conflict("This event is full.", "full");
    }

    const insertResult = await db
      .from("signups")
      .insert({ slot_id: id, user_id: userId })
      .select("slot_id")
      .returns<{ slot_id: number }[]>();

    if (insertResult.error) {
      // Unique (slot_id, user_id) violation: you were already in this one.
      if (insertResult.error.code === "23505") {
        throw conflict("You already joined this event.", "already_joined");
      }
      console.error(insertResult.error);
      throw badRequest("Could not join that event.");
    }

    const people = await loadPeople([slot.owner_id]);
    res.status(201).json((await decorate([slot], userId, people))[0]);
  }),
);

eventsRouter.delete(
  "/:id/join",
  asyncHandler(async (req, res) => {
    const id = parseId(req.params.id);

    const rows = orThrow(
      await db
        .from("signups")
        .delete()
        .eq("slot_id", id)
        .eq("user_id", req.user!.id)
        .select("slot_id")
        .returns<{ slot_id: number }[]>(),
    );

    if (rows.length === 0) {
      throw notFound(`You are not signed up for event ${id}.`);
    }
    res.status(204).end();
  }),
);
