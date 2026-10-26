import {
  MenuContent,
  MenuItem,
  MenuLabel,
  MenuRadioGroup,
  MenuRadioItem,
  MenuRoot,
  MenuSeparator,
  MenuTrigger,
} from "./menu.client.js";

/**
 * Dropdown menu for Backoffice header controls (branch switcher, account).
 * `<Menu.Root><Menu.Trigger/><Menu.Content><Menu.RadioGroup><Menu.RadioItem/>…</Menu.RadioGroup><Menu.Item/></Menu.Content></Menu.Root>`.
 */
export const Menu = {
  Root: MenuRoot,
  Trigger: MenuTrigger,
  Content: MenuContent,
  Label: MenuLabel,
  Item: MenuItem,
  RadioGroup: MenuRadioGroup,
  RadioItem: MenuRadioItem,
  Separator: MenuSeparator,
};
