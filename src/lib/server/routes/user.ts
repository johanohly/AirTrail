import { authedProcedure, publicProcedure, router } from "../trpc";
import { db } from "$lib/db";
import { sql } from "kysely";

export const userRouter = router({
  me: authedProcedure.query(({ ctx: { user } }) => {
    return user;
  }),
  isSetup: publicProcedure.query(async () => {
    const users = await db.selectFrom("User").select(sql`1`.as("exists")).limit(1).execute();
    return users.length > 0;
  })
});