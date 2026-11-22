import Content from './dropdown-menu-content.svelte';
import Item from './dropdown-menu-item.svelte';

import { DropdownMenu as DropdownMenuPrimitive } from '$lib/primitives';

const Root = DropdownMenuPrimitive.Root;
const Trigger = DropdownMenuPrimitive.Trigger;
const Separator = DropdownMenuPrimitive.Separator;

export { Root, Trigger, Content, Item, Separator };
