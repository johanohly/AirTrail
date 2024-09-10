import { Popover as PopoverPrimitive } from 'bits-ui';
import Content from './popover-content.svelte';
const Root = PopoverPrimitive.Root;
const Trigger = PopoverPrimitive.Trigger;
const Close = PopoverPrimitive.Close;
const Arrow = PopoverPrimitive.Arrow;

export {
  Root,
  Content,
  Trigger,
  Close,
  Arrow,
  //
  Root as Popover,
  Content as PopoverContent,
  Trigger as PopoverTrigger,
  Close as PopoverClose,
};
