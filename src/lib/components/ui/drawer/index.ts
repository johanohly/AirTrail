import { Dialog as DialogPrimitive } from 'bits-ui';

import Content from './drawer-content.svelte';
import Description from './drawer-description.svelte';
import Footer from './drawer-footer.svelte';
import Header from './drawer-header.svelte';
import Overlay from './drawer-overlay.svelte';
import Title from './drawer-title.svelte';
import Root from './drawer.svelte';

const Trigger = DialogPrimitive.Trigger;
const Portal = DialogPrimitive.Portal;
const Close = DialogPrimitive.Close;

export {
  Root,
  Content,
  Description,
  Overlay,
  Footer,
  Header,
  Title,
  Trigger,
  Portal,
  Close,

  //
  Root as Drawer,
  Content as DrawerContent,
  Description as DrawerDescription,
  Overlay as DrawerOverlay,
  Footer as DrawerFooter,
  Header as DrawerHeader,
  Title as DrawerTitle,
  Trigger as DrawerTrigger,
  Portal as DrawerPortal,
  Close as DrawerClose,
};
