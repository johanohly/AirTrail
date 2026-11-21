<script lang="ts" generics="TData = unknown, TContext = any">
	import { CalendarDate, type DateValue } from "@internationalized/date";
	import { afterTick } from "svelte-toolbelt";
	import DateRangePickerRoot from "$lib/primitives/bits/date-range-picker/components/date-range-picker.svelte";
	import DateRangePickerCalendar from "$lib/primitives/bits/date-range-picker/components/date-range-picker-calendar.svelte";
	import DateRangePickerHeader from "$lib/primitives/bits/calendar/components/calendar-header.svelte";
	import DateRangePickerPrevButton from "$lib/primitives/bits/calendar/components/calendar-prev-button.svelte";
	import DateRangePickerNextButton from "$lib/primitives/bits/calendar/components/calendar-next-button.svelte";
	import DateRangePickerHeading from "$lib/primitives/bits/calendar/components/calendar-heading.svelte";
	import DateRangePickerGrid from "$lib/primitives/bits/calendar/components/calendar-grid.svelte";
	import DateRangePickerGridHead from "$lib/primitives/bits/calendar/components/calendar-grid-head.svelte";
	import DateRangePickerHeadCell from "$lib/primitives/bits/calendar/components/calendar-head-cell.svelte";
	import DateRangePickerGridBody from "$lib/primitives/bits/calendar/components/calendar-grid-body.svelte";
	import DateRangePickerGridRow from "$lib/primitives/bits/calendar/components/calendar-grid-row.svelte";
	import DateRangePickerCell from "$lib/primitives/bits/range-calendar/components/range-calendar-cell.svelte";
	import DateRangePickerDay from "$lib/primitives/bits/range-calendar/components/range-calendar-day.svelte";
	import { useMaybeMenuContentContext } from "$lib/primitives/bits/menu/menu.svelte.js";
	import type { DateRange } from "$lib/primitives/shared/index.js";
	import type { Column, DataTableFilterActions, FilterModel } from "../types.js";
	import { filterAttrs } from "../filter.svelte.js";

	let {
		filter,
		column,
		actions,
		locale = "en",
	}: {
		filter?: FilterModel<"date">;
		column: Column<TData, "date">;
		actions: DataTableFilterActions<TContext>;
		locale?: string;
	} = $props();

	type CalendarMode = "normal" | "year" | "month";

	const menuContent = useMaybeMenuContentContext();
	const minValue = new CalendarDate(1900, 1, 1);
	const maxValue = new CalendarDate(2100, 12, 31);

	let rangeValue = $state<DateRange>(rangeFromFilter(filter));
	let calendarPlaceholder = $state<DateValue | undefined>(rangeValue.start ?? rangeValue.end);
	let mode = $state<CalendarMode>("normal");
	let calendarRef: HTMLElement | null = $state(null);
	let focusedForOpen = $state(false);
	let yearEl: HTMLButtonElement | null = $state(null);
	let committedKey = $state(serializeRange(rangeValue));

	const selectedYear = $derived(
		calendarPlaceholder?.year ?? rangeValue.start?.year ?? rangeValue.end?.year
	);
	const selectedMonth = $derived(
		calendarPlaceholder?.month ?? rangeValue.start?.month ?? rangeValue.end?.month
	);

	const selectableYears = $derived.by(() => {
		const years: Array<{ value: number; disabled: boolean }> = [];
		for (let year = minValue.year; year <= maxValue.year; year += 1) {
			years.push({ value: year, disabled: false });
		}
		return years;
	});

	const selectableMonths = $derived.by(() => {
		const year = selectedYear ?? new Date().getFullYear();
		return Array.from({ length: 12 }, (_, index) => {
			const month = index + 1;
			const disabled =
				(year === minValue.year && month < minValue.month) ||
				(year === maxValue.year && month > maxValue.month);
			return {
				value: month,
				label: formatMonth(month, "short"),
				disabled,
			};
		});
	});

	$effect(() => {
		const nextRange = rangeFromFilter(filter);
		const nextKey = serializeRange(nextRange);
		if (!isSameRange(nextRange, rangeValue)) {
			rangeValue = nextRange;
			if (nextRange.start || nextRange.end) {
				calendarPlaceholder = nextRange.start ?? nextRange.end;
			}
		}
		committedKey = nextKey;
	});

	$effect(() => {
		if (mode === "year" && yearEl) {
			yearEl.scrollIntoView({ block: "nearest" });
		}
	});

	$effect(() => {
		if (!menuContent) return;
		if (!menuContent.parentMenu.opts.open.current) {
			focusedForOpen = false;
			return;
		}
		if (focusedForOpen) return;
		if (menuContent.parentMenu.pendingOpenModality === "preview") return;
		afterTick(() => {
			if (!menuContent.parentMenu.opts.open.current) return;
			focusCalendar();
			focusedForOpen = true;
		});
	});

	function rangeFromFilter(value: FilterModel<"date"> | undefined): DateRange {
		return normalizeRange({
			start: dateToCalendarDate(value?.values[0]),
			end: dateToCalendarDate(value?.values[1]),
		});
	}

	function dateToCalendarDate(date: Date | undefined): DateValue | undefined {
		if (!date) return undefined;
		return new CalendarDate(date.getFullYear(), date.getMonth() + 1, date.getDate());
	}

	function calendarDateToDate(value: DateValue | undefined): Date | undefined {
		if (!value) return undefined;
		return new Date(value.year, value.month - 1, value.day);
	}

	function isSameDateValue(a: DateValue | undefined, b: DateValue | undefined) {
		if (!a || !b) return a === b;
		return a.year === b.year && a.month === b.month && a.day === b.day;
	}

	function isSameRange(a: DateRange, b: DateRange) {
		return isSameDateValue(a.start, b.start) && isSameDateValue(a.end, b.end);
	}

	function normalizeRange(value: DateRange): DateRange {
		if (value.start && value.end && isSameDateValue(value.start, value.end)) {
			return { start: value.start, end: undefined };
		}
		return value;
	}

	function serializeRange(value: DateRange) {
		return `${value.start?.toString() ?? ""}|${value.end?.toString() ?? ""}`;
	}

	function commitRange(value: DateRange) {
		const range = normalizeRange(value);
		const nextKey = serializeRange(range);
		if (nextKey === committedKey) return;
		committedKey = nextKey;

		const startDate = calendarDateToDate(range.start);
		const endDate = calendarDateToDate(range.end);
		const values =
			startDate && endDate
				? [startDate, endDate]
				: startDate
					? [startDate]
					: endDate
						? [endDate]
						: [];

		if (values.length === 0) {
			if (filter?.values.length) actions.removeFilter(column.id);
			return;
		}

		actions.setFilterValue(column, values);
	}

	function handleRangeValueChange(value: DateRange | undefined) {
		const nextRange = normalizeRange({
			start: value?.start,
			end: value?.end,
		});
		rangeValue = nextRange;
		if (nextRange.start || nextRange.end) {
			calendarPlaceholder = nextRange.start ?? nextRange.end;
		}
		commitRange(nextRange);
	}

	function selectYear(year: number) {
		const current =
			calendarPlaceholder ??
			rangeValue.start ??
			rangeValue.end ??
			new CalendarDate(year, 1, 1);
		calendarPlaceholder = current.set({ year });
		mode = "month";
	}

	function selectMonth(month: number) {
		const year = selectedYear ?? new Date().getFullYear();
		const current =
			calendarPlaceholder ??
			rangeValue.start ??
			rangeValue.end ??
			new CalendarDate(year, month, 1);
		calendarPlaceholder = current.set({ month });
		mode = "normal";
	}

	function formatMonth(month: number, format: "short" | "long") {
		return new Intl.DateTimeFormat(locale, { month: format }).format(
			new Date(2020, month - 1, 1)
		);
	}

	function focusCalendar() {
		const day =
			calendarRef?.querySelector<HTMLElement>('[data-bits-day][tabindex="0"]') ??
			calendarRef?.querySelector<HTMLElement>("[data-bits-day]:not([data-disabled])");
		day?.focus({ preventScroll: true });
	}

	function stopMenuKeyboard(event: KeyboardEvent) {
		if (event.key === "Escape" || event.key === "Tab") return;
		event.stopPropagation();
	}
</script>

<DateRangePickerRoot
	value={rangeValue}
	onValueChange={handleRangeValueChange}
	bind:placeholder={calendarPlaceholder}
	granularity="day"
	weekdayFormat="short"
	fixedWeeks={true}
	closeOnRangeSelect={false}
	{locale}
	{minValue}
	{maxValue}
	data-column-type="date"
	{...{ [filterAttrs["value-editor"]]: "", [filterAttrs["date-editor"]]: "" }}
	onkeydown={stopMenuKeyboard}
>
	<DateRangePickerCalendar bind:ref={calendarRef} {...{ [filterAttrs["date-calendar"]]: "" }}>
		{#snippet children({ months, weekdays })}
			<DateRangePickerHeader {...{ [filterAttrs["date-calendar-header"]]: "" }}>
				<DateRangePickerPrevButton
					aria-label="Previous month"
					{...{ [filterAttrs["date-calendar-nav"]]: "" }}
				>
					<svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">
						<path
							d="M10 12 6 8l4-4"
							fill="none"
							stroke="currentColor"
							stroke-width="1.8"
							stroke-linecap="round"
							stroke-linejoin="round"
						/>
					</svg>
				</DateRangePickerPrevButton>
				<DateRangePickerHeading {...{ [filterAttrs["date-calendar-heading"]]: "" }}>
					<div>
						<button
							type="button"
							data-active={mode === "month" ? "" : undefined}
							onclick={() => (mode = mode === "month" ? "normal" : "month")}
							{...{ [filterAttrs["date-calendar-heading-button"]]: "" }}
						>
							{formatMonth(
								calendarPlaceholder?.month ?? new Date().getMonth() + 1,
								"long"
							)}
						</button>
						<button
							type="button"
							data-active={mode === "year" ? "" : undefined}
							onclick={() => (mode = mode === "year" ? "normal" : "year")}
							{...{ [filterAttrs["date-calendar-heading-button"]]: "" }}
						>
							{calendarPlaceholder?.year ?? new Date().getFullYear()}
						</button>
					</div>
				</DateRangePickerHeading>
				<DateRangePickerNextButton
					aria-label="Next month"
					{...{ [filterAttrs["date-calendar-nav"]]: "" }}
				>
					<svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">
						<path
							d="m6 4 4 4-4 4"
							fill="none"
							stroke="currentColor"
							stroke-width="1.8"
							stroke-linecap="round"
							stroke-linejoin="round"
						/>
					</svg>
				</DateRangePickerNextButton>
			</DateRangePickerHeader>

			<div data-mode={mode}>
				<div>
					{#each months as month (month.value.toString())}
						<DateRangePickerGrid {...{ [filterAttrs["date-calendar-grid"]]: "" }}>
							<DateRangePickerGridHead>
								<DateRangePickerGridRow>
									{#each weekdays as weekday (weekday)}
										<DateRangePickerHeadCell
											{...{ [filterAttrs["date-calendar-head-cell"]]: "" }}
										>
											{weekday.slice(0, 2)}
										</DateRangePickerHeadCell>
									{/each}
								</DateRangePickerGridRow>
							</DateRangePickerGridHead>
							<DateRangePickerGridBody>
								{#each month.weeks as weekDates, weekIndex (`week-${weekIndex}`)}
									<DateRangePickerGridRow>
										{#each weekDates as date (date.toString())}
											<DateRangePickerCell
												{date}
												month={month.value}
												{...{ [filterAttrs["date-calendar-cell"]]: "" }}
											>
												<DateRangePickerDay
													{...{ [filterAttrs["date-calendar-day"]]: "" }}
												/>
											</DateRangePickerCell>
										{/each}
									</DateRangePickerGridRow>
								{/each}
							</DateRangePickerGridBody>
						</DateRangePickerGrid>
					{/each}
				</div>

				{#if mode !== "normal"}
					<div {...{ [filterAttrs["date-calendar-mode-panel"]]: "" }}>
						{#if mode === "year"}
							<div>
								{#each selectableYears as year (year.value)}
									{#if year.value === selectedYear}
										<button
											type="button"
											bind:this={yearEl}
											disabled={year.disabled}
											data-active=""
											onclick={() => selectYear(year.value)}
											{...{ [filterAttrs["date-calendar-mode-option"]]: "" }}
										>
											{year.value}
										</button>
									{:else}
										<button
											type="button"
											disabled={year.disabled}
											onclick={() => selectYear(year.value)}
											{...{ [filterAttrs["date-calendar-mode-option"]]: "" }}
										>
											{year.value}
										</button>
									{/if}
								{/each}
							</div>
						{:else}
							<div>
								{#each selectableMonths as month (month.value)}
									<button
										type="button"
										disabled={month.disabled}
										data-active={month.value === selectedMonth ? "" : undefined}
										onclick={() => selectMonth(month.value)}
										{...{ [filterAttrs["date-calendar-mode-option"]]: "" }}
									>
										{month.label}
									</button>
								{/each}
							</div>
						{/if}
					</div>
				{/if}
			</div>
		{/snippet}
	</DateRangePickerCalendar>
</DateRangePickerRoot>
