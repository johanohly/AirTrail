<script lang="ts">
  import { trpc } from "$lib/trpc";
  import { Button } from "$lib/components/ui/button";
  import { Input } from "$lib/components/ui/input";
  import { Label } from "$lib/components/ui/label";
  import { goto } from "$app/navigation";
  import { onMount } from "svelte";

  const query = trpc.user.isSetup.query();
  const isSetup = $query.data;
  onMount(() => {
    if (!isSetup) {
      goto("/setup");
    }
  });
</script>

<div class="w-full lg:grid lg:min-h-[600px] lg:grid-cols-2 xl:min-h-[800px]">
  <div class="flex items-center justify-center py-12">
    <div class="mx-auto grid w-[350px] gap-6">
      <div class="grid gap-2 text-center">
        <h1 class="text-3xl font-bold">
          Login
        </h1>
        <p class="text-muted-foreground text-balance">
          Welcome back! Enter your email and password to login
        </p>
      </div>
      <div class="grid gap-4">
        <div class="grid gap-2">
          <Label for="email">Email</Label>
          <Input id="email" type="email" placeholder="m@example.com" required />
        </div>
        <div class="grid gap-2">
          <div class="flex items-center">
            <Label for="password">Password</Label>
            <a href="##" class="ml-auto inline-block text-sm underline">
              Forgot your password?
            </a>
          </div>
          <Input id="password" type="password" required />
        </div>
        <Button type="submit" class="w-full">Login</Button>
      </div>
      <div class="mt-4 text-center text-sm">
        Don&apos;t have an account?
        <a href="##" class="underline"> Sign up </a>
      </div>
    </div>
  </div>
  <div class="bg-muted hidden lg:block">
    <img
      src="/images/placeholder.svg"
      alt="placeholder"
      width="1920"
      height="1080"
      class="h-full w-full object-cover dark:brightness-[0.2] dark:grayscale"
    />
  </div>
</div>
