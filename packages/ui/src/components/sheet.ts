import { DialogClose, DialogDescription, DialogRoot, DialogTitle, DialogTrigger } from "./dialog.client.js";
import { SheetContent } from "./sheet.client.js";

/**
 * Short choices on Customer Web (pickup time, item options, coupon).
 * Put the primary action last as a full-width touch Button.
 */
export const Sheet = {
  Root: DialogRoot,
  Trigger: DialogTrigger,
  Content: SheetContent,
  Title: DialogTitle,
  Description: DialogDescription,
  Close: DialogClose,
};
