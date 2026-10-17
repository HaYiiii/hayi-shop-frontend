import { FieldError, FieldHint, FieldInput, FieldLabel, FieldRoot, FieldSelect } from "./field.client.js";

/**
 * Labelled form control: `<Field.Root><Field.Label/><Field.Input/><Field.Hint/><Field.Error/></Field.Root>`.
 * Ids, aria-describedby and aria-invalid are wired automatically.
 */
export const Field = {
  Root: FieldRoot,
  Label: FieldLabel,
  Input: FieldInput,
  Select: FieldSelect,
  Hint: FieldHint,
  Error: FieldError,
};
