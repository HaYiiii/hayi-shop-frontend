import { Field, cn } from "@hayi/ui";
import { type ComponentProps, type ReactNode, type RefObject, useEffect } from "react";
import { type BranchFieldName, type BranchFields, fieldNames } from "../branch-form";

export type FieldErrors = Partial<Record<BranchFieldName, string>>;

type TextFieldProps = Omit<ComponentProps<typeof Field.Input>, "name" | "defaultValue"> & {
  name: BranchFieldName;
  label: string;
  values?: Partial<BranchFields> | undefined;
  errors: FieldErrors;
  hint?: string;
};

/** One labelled Branch input; a required one shows `*` (D3c screen 15). */
export function BranchTextField({ name, label, values, errors, hint, required, className, ...input }: TextFieldProps) {
  return (
    <Field.Root className={className}>
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

export function FieldGroup({ legend, children, className }: { legend?: string; children: ReactNode; className?: string }) {
  return (
    <fieldset className={cn("m-0 grid min-w-0 grid-cols-1 gap-x-4 gap-y-3.5 border-0 p-0 md:grid-cols-2", className)}>
      {legend ? <legend className="mb-2.5 p-0 text-body-lg font-semibold">{legend}</legend> : null}
      {children}
    </fieldset>
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
      <BranchTextField {...shared} name="line" label="Số nhà, đường" required autoComplete="address-line1" className="md:col-span-2" />
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
