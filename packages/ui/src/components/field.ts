import {
  FieldControl,
  FieldError,
  FieldGroup,
  FieldHint,
  FieldInput,
  FieldLabel,
  FieldRoot,
  FieldSelect,
  FieldTextarea,
} from "./field.client.js";

/**
 * Labelled form control: `<Field.Root><Field.Label/><Field.Input/><Field.Hint/><Field.Error/></Field.Root>`.
 * Ids, aria-describedby and aria-invalid are wired automatically; an error replaces the hint.
 * Fields side by side go in `<Field.Group>`; a control with a unit goes in `<Field.Control>`.
 */
export const Field = {
  Group: FieldGroup,
  Root: FieldRoot,
  Label: FieldLabel,
  Control: FieldControl,
  Input: FieldInput,
  Select: FieldSelect,
  Textarea: FieldTextarea,
  Hint: FieldHint,
  Error: FieldError,
};
