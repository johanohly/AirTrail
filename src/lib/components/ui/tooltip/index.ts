import { Tooltip as TooltipPrimitive } from "bits-ui";
import Content from "./tooltip-content.svelte";
import AutoTooltip from "./auto-tooltip.svelte";

const Root = TooltipPrimitive.Root;
const Trigger = TooltipPrimitive.Trigger;

export {
  Root,
  Trigger,
  Content,
  AutoTooltip,
  //
  Root as Tooltip,
  Content as TooltipContent,
  Trigger as TooltipTrigger
};
