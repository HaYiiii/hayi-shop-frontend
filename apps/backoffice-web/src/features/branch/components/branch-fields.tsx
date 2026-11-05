import { Field } from "@hayi/ui";
import { type ComponentProps, type ReactNode, type RefObject, useEffect } from "react";
import { type BranchFieldName, type BranchFields, fieldNames } from "../branch-form";

export type FieldErrors = Partial<Record<BranchFieldName, string>>;

type TextFieldProps = Omit<ComponentProps<typeof Field.Input>, "name" | "defaultValue"> & {
  name: BranchFieldName;
  label: string;
  values?: Partial<BranchFields> | undefined;
  errors: FieldErrors;
  hint?: string;
  span?: "full";
};

/** One labelled Branch input; a required one shows `*` (D3c screen 15). */
export function BranchTextField({ name, label, values, errors, hint, required, span, ...input }: TextFieldProps) {
  return (
    <Field.Root span={span}>
      <Field.Label>
        {label}
        {required ? (
          <span aria-hidden="true" className="text-danger">
            {" *"}
          </span>
        ) : null}
      </Field.Label>
      <Field.Input name={name} required={required} defaultValue={values?.[name]} {...input} />
      {errors[name] ? <Field.Error aria-live="polite">{errors[name]}</Field.Error> : null}
      {hint ? <Field.Hint>{hint}</Field.Hint> : null}
    </Field.Root>
  );
}

/** Branch fields two per row (D2 form layout); with a legend it is a named fieldset. */
export function FieldGroup({ legend, children }: { legend?: string; children: ReactNode }) {
  if (!legend) return <Field.Group>{children}</Field.Group>;
  return (
    <Field.Group asChild>
      <fieldset>
        <legend>{legend}</legend>
        {children}
      </fieldset>
    </Field.Group>
  );
}

interface GroupProps {
  values?: Partial<BranchFields> | undefined;
  errors: FieldErrors;
  disabled?: boolean;
}

export function AddressFields({ values, errors, disabled }: GroupProps) {
  const shared = { values, errors, disabled, autoComplete: "off" } as const;
  return (
    <>
      <BranchTextField {...shared} name="line" label="Số nhà, đường" required autoComplete="address-line1" span="full" />
      <BranchTextField {...shared} name="ward" label="Phường / xã" autoComplete="address-level3" />
      <BranchTextField {...shared} name="district" label="Quận / huyện" autoComplete="address-level2" />
      <BranchTextField {...shared} name="province" label="Tỉnh / thành" required autoComplete="address-level1" />
      <BranchTextField
        {...shared}
        name="location"
        label="Toạ độ (tuỳ chọn)"
        inputMode="decimal"
        spellCheck={false}
        placeholder="Ví dụ: 10.7757, 106.7019…"
        className="tabular-nums"
      />
    </>
  );
}

export function ContactFields({ values, errors, disabled }: GroupProps) {
  const shared = { values, errors, disabled, autoComplete: "off" } as const;
  return (
    <>
      <BranchTextField {...shared} name="phone" label="Số điện thoại" type="tel" inputMode="tel" placeholder="Ví dụ: 028 3838 0000…" />
      <BranchTextField {...shared} name="email" label="Email" type="email" spellCheck={false} placeholder="Ví dụ: q1@hayi.vn…" />
    </>
  );
}

/**
 * After a failed submit, put the keyboard on the first field (in form order) that has an error.
 * `attempt` counts submits, so the same errors on a later submit focus again. The field is found by name,
 * right after the commit: waiting for Field to mark it `aria-invalid` could steal focus once the user types on.
 */
export function useFocusFirstError(form: RefObject<HTMLFormElement | null>, errors: FieldErrors, attempt: number) {
  const first = fieldNames.find((name) => errors[name]);
  useEffect(() => {
    if (!first) return;
    const control = form.current?.elements.namedItem(first);
    if (control instanceof HTMLElement) control.focus();
  }, [form, first, attempt]);
}

export const locationError = "Nhập vĩ độ và kinh độ cách nhau bằng dấu phẩy, ví dụ 10.7757, 106.7019.";
