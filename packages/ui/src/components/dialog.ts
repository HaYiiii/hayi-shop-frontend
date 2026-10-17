import {
  DialogActions,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogRoot,
  DialogTitle,
  DialogTrigger,
} from "./dialog.client.js";

/**
 * Confirmation dialog for decisions (cancel order, approve refund, step-up).
 * Not for plain notices (Toast) or long mobile forms (Sheet).
 */
export const Dialog = {
  Root: DialogRoot,
  Trigger: DialogTrigger,
  Content: DialogContent,
  Title: DialogTitle,
  Description: DialogDescription,
  Actions: DialogActions,
  Close: DialogClose,
};
