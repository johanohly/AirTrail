import { Tooltip as TooltipPrimitive } from 'bits-ui';

import AutoTooltip from './auto-tooltip.svelte';
import HelpTooltip from './help-tooltip.svelte';
import TextTooltip from './text-tooltip.svelte';
import Content from './tooltip-content.svelte';

const Root = TooltipPrimitive.Root;
const Portal = TooltipPrimitive.Portal;
const Trigger = TooltipPrimitive.Trigger;
const Provider = TooltipPrimitive.Provider;

export {
  Root,
  Portal,
  Trigger,
  Provider,
  Content,
  AutoTooltip,
  HelpTooltip,
  TextTooltip,
  //
  Root as Tooltip,
  Content as TooltipContent,
  Trigger as TooltipTrigger,
};
