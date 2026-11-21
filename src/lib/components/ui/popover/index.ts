import Content from './popover-content.svelte';

import { Popover as PopoverPrimitive } from '$lib/primitives';

const Root = PopoverPrimitive.Root;
const Trigger = PopoverPrimitive.Trigger;
const Close = PopoverPrimitive.Close;
const Portal = PopoverPrimitive.Portal;

export {
  Root,
  Content,
  Trigger,
  Close,
  Portal,
  //
  Root as Popover,
  Content as PopoverContent,
  Trigger as PopoverTrigger,
  Close as PopoverClose,
};
