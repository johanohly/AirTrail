import { authedProcedure, router } from "../trpc";
import { db } from "$lib/db";
import { z } from "zod";
import type { Flight } from "$lib/db/schema";

export const flightRouter = router({
  list: authedProcedure.query(async ({ ctx: { user } }) => {
    const flights = await db.selectFrom("Flight").selectAll().where("userId", "=", user.id).execute();
    return flights;
  }),
  delete: authedProcedure
    .input(z.number())
    .mutation(async ({ ctx: { user }, input }) => {
      await db.deleteFrom("Flight").where("id", "=", input).where("userId", "=", user.id).execute();
    }),
  createMany: authedProcedure
    .input(z.custom<Omit<Flight, "id" | "userId">[]>())
    .mutation(async ({ ctx: { user }, input }) => {
      const flights = input.map((flight) => ({ ...flight, userId: user.id }));
      await db.insertInto("Flight").values(flights).execute();
    })
});