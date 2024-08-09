import type { Actions, PageServerLoad } from "./$types";
import { trpcServer } from "$lib/server/server";
import { message, superValidate } from "sveltekit-superforms";
import { zod } from "sveltekit-superforms/adapters";
import { signInSchema } from "$lib/zod/auth";
import { createSession, getUser } from "$lib/server/utils/auth";
import { Argon2id } from "oslo/password";
import { lucia } from "$lib/server/auth";
import { fail, redirect } from "@sveltejs/kit";

export const load: PageServerLoad = async (event) => {
  await trpcServer.user.isSetup.ssr(event);

  const form = await superValidate(zod(signInSchema));
  return { form };
};

export const actions: Actions = {
  default: async (event) => {
    const form = await superValidate(event, zod(signInSchema));
    if (!form.valid) {
      return fail(400, { form });
    }

    const { username, password } = form.data;

    const user = await getUser(username);
    if (!user) {
      return message(form, "Invalid username or password", { status: 403 });
    }

    const validPassword = await new Argon2id().verify(user.password, password);
    if (!validPassword) {
      return message(form, "Invalid username or password", { status: 403 });
    }

    await createSession(lucia, user.id, event.cookies);

    redirect(302, "/");
  }
};
