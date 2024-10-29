import { Tooltip as TooltipPrimitive } from 'bits-ui';
import Content from './tooltip-content.svelte';
import AutoTooltip from './auto-tooltip.svelte';
import TextTooltip from './text-tooltip.svelte';

const Root = TooltipPrimitive.Root;
const Trigger = TooltipPrimitive.Trigger;
const Provider = TooltipPrimitive.Provider;

export {
  Root,
  Trigger,
  Provider,
  Content,
  AutoTooltip,
  TextTooltip,
  //
  Root as Tooltip,
  Content as TooltipContent,
  Trigger as TooltipTrigger,
};
