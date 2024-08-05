<script lang="ts">
  import { page } from "$app/stores";
  import { cn } from "$lib/utils";
  import { Button } from "$lib/components/ui/button";
  import { cubicInOut } from "svelte/easing";
  import { crossfade } from "svelte/transition";
  import { Separator } from "$lib/components/ui/separator";

  const SETTINGS_PAGES = [
    { title: "Overview", href: "/settings/overview" },
    { title: "Import", href: "/settings/import" }
  ];

  const [send, receive] = crossfade({
    duration: 250,
    easing: cubicInOut
  });
</script>

<div class="page-container">
  <div class="space-y-6 p-10 pb-16 block">
    <div class="space-y-0.5">
      <h2 class="text-2xl font-bold tracking-tight">Settings</h2>
      <p class="text-muted-foreground">
        Manage your account settings and import flights from other sources.
      </p>
    </div>
    <Separator class="my-6" />
    <div class="flex flex-col space-y-8 lg:flex-row lg:space-x-12 lg:space-y-0">
      <aside class="-mx-4 lg:w-1/5">
        <nav class="flex space-x-2 lg:flex-col lg:space-x-0 lg:space-y-1">
          {#each SETTINGS_PAGES as item}
            {@const isActive = $page.url.pathname === item.href}

            <Button
              href={item.href}
              variant="ghost"
              class={cn(
				!isActive && "hover:underline",
				"relative justify-start hover:bg-transparent"
			)}
              data-sveltekit-noscroll
            >
              {#if isActive}
                <div
                  class="bg-card-hover absolute inset-0 rounded-md"
                  in:send={{ key: "active-sidebar-tab" }}
                  out:receive={{ key: "active-sidebar-tab" }}
                />
              {/if}
              <div class="relative">
                {item.title}
              </div>
            </Button>
          {/each}
        </nav>
      </aside>
      <div class="flex-1 lg:max-w-2xl">
        <slot />
      </div>
    </div>
  </div>
</div>
