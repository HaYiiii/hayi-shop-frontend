import { Card, Field } from "@hayi/ui";
import { useId } from "react";
import type { Rules } from "../schedule-form";

type NumberRule = Exclude<keyof Rules, "isEnabled" | "slotDurationMinutes">;

interface PickupRulesProps {
  rules: Rules;
  /** Server `errors[]` by config field (`422 FULFILLMENT_CONFIG_INVALID`). */
  errors: Partial<Record<keyof Rules, string>>;
  onChange: (next: Partial<Rules>) => void;
}

function Minutes({ name, label, unit, hint, rules, errors, onChange, optional = false }: {
  name: NumberRule;
  label: string;
  unit: string;
  hint?: string;
  optional?: boolean;
} & PickupRulesProps) {
  return (
    <Field.Root>
      <Field.Label>{label}</Field.Label>
      <Field.Control>
        <Field.Input
          name={name}
          type="number"
          inputMode="numeric"
          min={0}
          step={1}
          required={!optional}
          autoComplete="off"
          className="w-24 tabular-nums"
          value={rules[name]}
          onChange={(e) => onChange({ [name]: e.target.value })}
        />
        <span className="text-label font-normal text-ink-muted">{unit}</span>
      </Field.Control>
      {hint ? <Field.Hint>{hint}</Field.Hint> : null}
      {errors[name] ? <Field.Error>{errors[name]}</Field.Error> : null}
    </Field.Root>
  );
}

/**
 * "Quy tắc đặt trước" (D3b screen 13) plus the PICKUP on/off switch; cutoff and lead live in the config only (N3).
 * A horizontal settings panel above the week (D2 form layout): two columns of label-left fields.
 */
export function PickupRules(props: PickupRulesProps) {
  const { rules, errors, onChange } = props;
  const titleId = useId();
  return (
    <Card role="region" aria-labelledby={titleId} className="gap-3.5 p-5">
      <div className="flex flex-wrap items-start gap-x-6 gap-y-3">
        <h2 id={titleId} className="text-title">
          Quy tắc đặt trước
        </h2>
        <label className="flex cursor-pointer items-start gap-2.5 text-body">
          <input
            type="checkbox"
            name="isEnabled"
            className="mt-0.5 size-[18px] shrink-0 accent-matcha-700"
            aria-labelledby={`${titleId}-on`}
            aria-describedby={`${titleId}-on-hint`}
            checked={rules.isEnabled}
            onChange={(e) => onChange({ isEnabled: e.target.checked })}
          />
          <span className="grid">
            <span id={`${titleId}-on`} className="font-semibold">
              Nhận đơn lấy tại quầy
            </span>
            <span id={`${titleId}-on-hint`} className="text-caption text-ink-muted">
              Tắt thì khách không thấy khung giờ nào của chi nhánh này.
            </span>
          </span>
        </label>
      </div>
      <div className="grid gap-x-8 gap-y-3 lg:grid-cols-2">
        <Field.Group orientation="horizontal">
          <Minutes
            {...props}
            name="sameDayCutoffMinutes"
            label="Đặt trước giờ lấy tối thiểu (trong ngày)"
            unit="phút"
            hint="Mặc định 180 phút. Ngày sau không áp dụng quy tắc này."
          />
          <Minutes {...props} name="maxAdvanceDays" label="Cho đặt trước tối đa" unit="ngày" />
        </Field.Group>
        <Field.Group orientation="horizontal">
          <Field.Root>
            <Field.Label>Độ dài mỗi khung</Field.Label>
            <Field.Select
              name="slotDurationMinutes"
              className="w-36"
              value={rules.slotDurationMinutes}
              onChange={(e) => onChange({ slotDurationMinutes: e.target.value })}
            >
              <option value="15">15 phút</option>
              <option value="30">30 phút</option>
            </Field.Select>
            {errors.slotDurationMinutes ? <Field.Error>{errors.slotDurationMinutes}</Field.Error> : null}
          </Field.Root>
          <Minutes
            {...props}
            name="customerCancelCutoffMinutes"
            label="Khách tự huỷ đơn đã xác nhận trước giờ lấy"
            unit="phút"
            hint="Để trống nếu khách không được tự huỷ."
            optional
          />
        </Field.Group>
      </div>
    </Card>
  );
}
