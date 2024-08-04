import { authedProcedure, router } from "../trpc";
import { db } from "$lib/db";

export const flightRouter = router({
  list: authedProcedure.query(async ({ ctx: { user } }) => {
    const flights = await db.selectFrom("flight").selectAll().where("userId", "=", user.id).execute();
    return flights;
  })
});