<script lang="ts">
	import NextStep from '$lib/components/NextStep.svelte';
	import { trpc } from '$lib/trpc';

	const greeting = trpc.greeting.query({ name: 'the o7 stack' });
</script>

<main class="flex h-screen flex-col items-center justify-center">
	<img src="/favicon.png" class="w-32" alt="o7 Logo" />
	<!--
		Notice how there's no flash of `undefined` here: that's because of the
		SSR in `+page.server.ts`! Try changing the `name` to see the difference.
	-->
	<h1 class="text-3xl font-bold">{$greeting.data}</h1>
	<h2 class="my-6 text-2xl">Next Steps:</h2>
	<div class="flex max-w-5xl justify-center gap-4 px-3">
		<NextStep
			title="Edit this page"
			learnMore="https://svelte.dev/tutorial/basics"
		>
			<p>
				Edit <code class="text-lime-300">src/routes/+page.svelte</code> to see your
				changes live.
			</p>
			<p>
				The source for these cards is in <code class="text-lime-300"
					>src/lib/components/NextStep.svelte</code
				>.
			</p>
			<p>
				There's some global styling in <code class="text-lime-300"
					>src/app.css</code
				>.
			</p>
		</NextStep>
		<NextStep
			title="Work on your database schema"
			learnMore="https://www.prisma.io/docs/concepts/components/prisma-schema"
		>
			<p>
				Write a Prisma schema in <code class="text-red-300"
					>prisma/schema.prisma</code
				>.
			</p>
			<p>
				Insert your database connection details into <code class="text-red-300"
					>.env</code
				>.
			</p>
			<p>
				Run <code class="text-red-300">pnpm db:push</code> to update your database
				typings.
			</p>
			<p>
				Remember that you're using <a
					href="https://github.com/kysely-org/kysely"
					target="_blank"
					class="text-blue-400 hover:underline">Kysely</a
				>
				instead of Prisma to make your queries, and
				<code class="text-red-300">import {'{ db }'} from '$lib/db'</code>!
			</p>
		</NextStep>
		<NextStep title="Create some tRPC routes" learnMore="https://trpc.io">
			<p>
				There's an example query in <code class="text-purple-300"
					>src/lib/server/routes/_app.ts</code
				>.
			</p>
			<p>
				Also take a look at <code class="text-purple-300">
					src/routes/+page.server.ts</code
				> to see how server-side rendering works!
			</p>
		</NextStep>
	</div>
</main>

<style>
	code {
		background: theme('colors.zinc.900');
		padding: theme('spacing[0.5]');
	}
</style>
