import { ApiError } from "@hayi/api-client";
import { formatIsoDate } from "@hayi/domain-utils";
import { Button, Skeleton, Tabs } from "@hayi/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useId, useRef, useState } from "react";
import { errorCode, useApi } from "../../../lib/api";
import { FormAlert } from "../../../lib/form-alert";
import { PermissionGuard } from "../../../lib/permission-guard";
import { hoursQuery } from "../../branch/api/hours";
import { dayLabels } from "../../branch/hours-form";
import {
  type FulfillmentConfig,
  type VersionedSchedule,
  configQuery,
  fulfillmentKeys,
  replaceWeeklySchedule,
  saveConfig,
  scheduleQuery,
} from "../api/fulfillment";
import {
  type OverbookedSlot,
  type RequestPositions,
  type Rules,
  type ScheduleErrors,
  type ScheduleWindow,
  type WeekSchedule,
  configRequest,
  missingWindowTimes,
  mixedCapacityDays,
  rulesOf,
  scheduleEditorOf,
  scheduleErrors,
  weeklyScheduleRequest,
} from "../schedule-form";
import { PickupRules } from "./pickup-rules";
import { type Notice, ScheduleOverrides } from "./schedule-overrides";
import { SlotPreview } from "./slot-preview";
import { type DayChange, WeeklySchedule } from "./weekly-schedule";

/** D3b screen 13: pickup windows, special days, booking rules and a slot preview (Fulfillment §8.3–8.5, API 09 §2). */
export function SlotConfigScreen({ branchId }: { branchId: string }) {
  return (
    <PermissionGuard permission="FULFILLMENT_CONFIG_MANAGE">
      <SlotConfigLoader branchId={branchId} />
    </PermissionGuard>
  );
}

function SlotConfigLoader({ branchId }: { branchId: string }) {
  const api = useApi();
  const queryClient = useQueryClient();
  const config = useQuery(configQuery(api, branchId));
  const schedule = useQuery(scheduleQuery(api, branchId));
  const hours = useQuery(hoursQuery(api, branchId));
  // Only "Tải lại" after a 412 throws the edits away: the editor starts again from the fetched data.
  const [round, setRound] = useState(0);

  if (!config.data || !schedule.data) {
    if (config.error || schedule.error) {
      return (
        <div className="grid justify-items-start gap-2">
          <FormAlert tone="danger">Chưa tải được khung giờ nhận đơn. Kiểm tra mạng rồi thử lại.</FormAlert>
          <Button variant="outline" onClick={() => void Promise.all([config.refetch(), schedule.refetch()])}>
            Thử lại
          </Button>
        </div>
      );
    }
    return <Skeleton className="h-96 w-full" />;
  }

  function openingHours(dayIndex: number) {
    if (!hours.data) return hours.isError ? "—" : "…";
    const ranges = hours.data.hours.weekly.filter((w) => w.dayOfWeek === dayIndex + 1).map((w) => `${w.open}–${w.close}`);
    return ranges.length > 0 ? ranges.join(", ") : "Đóng cửa";
  }

  async function reload() {
    await Promise.all([
      queryClient.refetchQueries({ queryKey: fulfillmentKeys.config(branchId) }),
      queryClient.refetchQueries({ queryKey: fulfillmentKeys.schedule(branchId) }),
    ]);
    setRound((n) => n + 1);
  }

  return (
    <SlotConfigEditor
      key={round}
      branchId={branchId}
      config={config.data}
      schedule={schedule.data}
      openingHours={openingHours}
      onReload={() => void reload()}
    />
  );
}

/** Whole config without what changes on every write. */
function configCore({ version: _v, overbookedSlots: _o, ...rest }: FulfillmentConfig) {
  return JSON.stringify(rest);
}

/** The rules were saved, the week was not: what to say and keep. */
class PartlySaved extends Error {
  constructor(
    readonly cause: unknown,
    readonly savedConfig: FulfillmentConfig | undefined,
  ) {
    super("Save failed");
  }
}

interface SaveInput {
  ifMatch: number;
  rules: Rules | null;
  weekly: { body: { weekly: ScheduleWindow[] } } | null;
}

const NUMBER_RULES = ["sameDayCutoffMinutes", "maxAdvanceDays", "customerCancelCutoffMinutes"] as const;

function rulesClientErrors(rules: Rules): Partial<Record<keyof Rules, string>> {
  const result: Partial<Record<keyof Rules, string>> = {};
  for (const name of NUMBER_RULES) {
    const value = rules[name].trim();
    if (value === "" && name === "customerCancelCutoffMinutes") continue;
    if (!/^\d+$/.test(value)) result[name] = "Nhập số nguyên từ 0 trở lên.";
  }
  return result;
}

function rulesServerErrors(errors: readonly { field: string; code: string }[]): Partial<Record<keyof Rules, string>> {
  const result: Partial<Record<keyof Rules, string>> = {};
  for (const error of errors) {
    if (error.field === "slotDurationMinutes") result.slotDurationMinutes ??= "Chọn 15 hoặc 30 phút.";
    else if ((NUMBER_RULES as readonly string[]).includes(error.field))
      result[error.field as (typeof NUMBER_RULES)[number]] ??= "Nhập số nguyên từ 0 trở lên.";
  }
  return result;
}

interface SlotConfigEditorProps {
  branchId: string;
  config: FulfillmentConfig;
  schedule: VersionedSchedule;
  openingHours: (dayIndex: number) => string;
  onReload: () => void;
}

function SlotConfigEditor({ branchId, config, schedule, openingHours, onReload }: SlotConfigEditorProps) {
  const api = useApi();
  const queryClient = useQueryClient();
  const weekly = schedule.schedule.weekly;
  // Config and schedule are one aggregate with one version (S1); the newer of the two answers is the current one.
  const version = Math.max(config.version, schedule.version);

  // What the editor started from; drafts are compared with it.
  const [basis, setBasis] = useState({ config, weekly, version });
  const [rules, setRules] = useState<Rules>(() => rulesOf(config));
  const [week, setWeek] = useState<WeekSchedule>(() => scheduleEditorOf(weekly));
  const [sent, setSent] = useState<RequestPositions>([]);
  const [clientErrors, setClientErrors] = useState<{ windows: ScheduleErrors["windows"]; rules: Partial<Record<keyof Rules, string>> } | null>(null);
  const [overbooked, setOverbooked] = useState<OverbookedSlot[]>([]);
  const [notice, setNotice] = useState<Notice>(null);
  const [tab, setTab] = useState("weekly");
  const [attempt, setAttempt] = useState(0);
  const tableRef = useRef<HTMLDivElement>(null);
  const overbookedId = useId();

  const rulesDirty = JSON.stringify(rules) !== JSON.stringify(rulesOf(basis.config));
  const weekDirty = JSON.stringify(week) !== JSON.stringify(scheduleEditorOf(basis.weekly));
  // A newer version with the same data (a special day, own save) is safe to save over; other data replaces an
  // untouched editor, and over edits the old version makes the save a 412.
  const serverMoved = configCore(config) !== configCore(basis.config) || JSON.stringify(weekly) !== JSON.stringify(basis.weekly);
  if (serverMoved && !rulesDirty && !weekDirty) {
    setBasis({ config, weekly, version });
    setRules(rulesOf(config));
    setWeek(scheduleEditorOf(weekly));
  }
  const ifMatch = serverMoved ? basis.version : version;

  const save = useMutation({
    mutationFn: async (input: SaveInput) => {
      let current = input.ifMatch;
      let savedConfig: FulfillmentConfig | undefined;
      let savedSchedule: VersionedSchedule | undefined;
      try {
        if (input.rules) {
          savedConfig = await saveConfig(api, branchId, current, configRequest(basis.config, input.rules));
          current = savedConfig.version;
        }
        if (input.weekly) {
          savedSchedule = await replaceWeeklySchedule(api, branchId, current, input.weekly.body);
          current = savedSchedule.version;
        }
      } catch (cause) {
        throw new PartlySaved(cause, savedConfig);
      }
      return { savedConfig, savedSchedule, version: current };
    },
  });

  function remember(savedConfig: FulfillmentConfig | undefined, savedSchedule: VersionedSchedule | undefined, latest: number) {
    if (savedConfig) queryClient.setQueryData(fulfillmentKeys.config(branchId), savedConfig);
    queryClient.setQueryData<VersionedSchedule>(fulfillmentKeys.schedule(branchId), (old) =>
      savedSchedule ?? (old ? { ...old, version: latest } : old),
    );
    void queryClient.invalidateQueries({ queryKey: [...fulfillmentKeys.all, "capacity", branchId] });
  }

  const cause = save.error instanceof PartlySaved ? save.error.cause : save.error;
  const partlySaved = save.error instanceof PartlySaved && save.error.savedConfig !== undefined;
  const code = errorCode(cause);
  const problemErrors = cause instanceof ApiError ? (cause.problem.errors ?? []) : [];
  const refused = cause instanceof ApiError && cause.status === 422;
  const serverErrors: ScheduleErrors = refused ? scheduleErrors(problemErrors, sent) : { windows: {}, capacity: {} };
  const windowErrors = clientErrors?.windows ?? serverErrors.windows;
  const ruleErrors = clientErrors?.rules ?? (refused ? rulesServerErrors(problemErrors) : {});
  const badWindows = Object.entries(windowErrors).flatMap(([day, windows]) =>
    Object.entries(windows).map(([index, reason]) => {
      const w = week[Number(day)]?.windows[Number(index)];
      const which = clientErrors || !w ? `khung ${Number(index) + 1}` : `khung ${w.start}–${w.end}`;
      return `${dayLabels[Number(day)]}: ${which} ${reason}.`;
    }),
  );
  const badCount = badWindows.length + Object.keys(serverErrors.capacity).length + Object.keys(ruleErrors).length;

  useEffect(() => {
    if (badCount === 0) return;
    // After a refused save, the keyboard goes to the first marked field.
    tableRef.current?.closest("main")?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
  }, [badCount, attempt]);

  function onDayChange(dayIndex: number): DayChange {
    return (change, reshape = false) => {
      if (reshape) {
        // Windows added or removed: the marks of the last save would point at the wrong ones.
        setClientErrors(null);
        if (!partlySaved) save.reset();
      }
      setWeek((current) => current.map((day, i) => (i === dayIndex ? change(day) : day)));
    };
  }

  function undo() {
    save.reset();
    setClientErrors(null);
    setRules(rulesOf(basis.config));
    setWeek(scheduleEditorOf(basis.weekly));
  }

  function submit() {
    setAttempt((n) => n + 1);
    setNotice(null);
    setOverbooked([]);
    if (!rulesDirty && !weekDirty) {
      setNotice({ tone: "success", text: "Không có thay đổi nào cần lưu." });
      return;
    }
    const missing = { windows: missingWindowTimes(week), rules: rulesClientErrors(rules) };
    if (Object.keys(missing.windows).length > 0 || Object.keys(missing.rules).length > 0) {
      save.reset();
      setClientErrors(missing);
      return;
    }
    setClientErrors(null);
    const request = weeklyScheduleRequest(week);
    setSent(request.at);
    save.mutate(
      { ifMatch, rules: rulesDirty ? rules : null, weekly: weekDirty ? request : null },
      {
        onSuccess: ({ savedConfig, savedSchedule, version: latest }) => {
          remember(savedConfig, savedSchedule, latest);
          const nextConfig = savedConfig ?? basis.config;
          const nextWeekly = savedSchedule?.schedule.weekly ?? basis.weekly;
          setBasis({ config: nextConfig, weekly: nextWeekly, version: latest });
          setRules(rulesOf(nextConfig));
          setWeek(scheduleEditorOf(nextWeekly));
          setOverbooked(savedSchedule?.schedule.overbookedSlots ?? savedConfig?.overbookedSlots ?? []);
          setNotice({ tone: "success", text: "Đã lưu khung giờ nhận đơn." });
        },
        onError: (error) => {
          if (!(error instanceof PartlySaved) || !error.savedConfig) return;
          const savedConfig = error.savedConfig;
          remember(savedConfig, undefined, savedConfig.version);
          setBasis((b) => ({ ...b, config: savedConfig, version: savedConfig.version }));
        },
      },
    );
  }

  const mixedCapacity = mixedCapacityDays(basis.weekly);
  const overrideDates = new Set(schedule.schedule.overrides.map((o) => o.date)).size;

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="font-display text-heading-lg">Khung giờ nhận đơn</h1>
        <span className="text-body text-ink-muted">Lấy tại quầy · đặt trước</span>
        <div className="ml-auto flex gap-2">
          <Button variant="ghost" disabled={!rulesDirty && !weekDirty} onClick={undo}>
            Hoàn tác
          </Button>
          <Button busy={save.isPending} onClick={submit}>
            Lưu thay đổi
          </Button>
        </div>
      </div>

      {notice ? <FormAlert tone={notice.tone}>{notice.text}</FormAlert> : null}
      {overbooked.length > 0 ? (
        <section aria-labelledby={overbookedId} className="grid gap-1.5 rounded-md bg-warning-soft px-3 py-2.5 text-label text-warning">
          <h2 id={overbookedId} className="font-semibold">
            Khung đã nhận nhiều đơn hơn sức chứa mới
          </h2>
          <ul className="grid gap-0.5 tabular-nums">
            {overbooked.map((slot) => (
              <li key={`${slot.date}-${slot.slotStart}`}>{overbookedText(slot)}</li>
            ))}
          </ul>
          <p className="font-normal">Đơn đã đặt không bị huỷ. Các khung này chỉ ngừng nhận đơn mới.</p>
        </section>
      ) : null}

      {/* The week needs the width: the rules sit above it, and beside it (D3b) only on wide screens. */}
      <div className="grid items-start gap-x-5 gap-y-4 2xl:grid-cols-[minmax(0,1fr)_320px]">
        <PickupRules
          rules={rules}
          errors={ruleErrors}
          onChange={(next) => {
            setClientErrors((e) => (e ? { ...e, rules: {} } : e));
            setRules((current) => ({ ...current, ...next }));
          }}
        />
        <div className="grid min-w-0 gap-4 2xl:col-start-1 2xl:row-start-1">
          <Tabs.Root value={tab} onValueChange={setTab}>
            <Tabs.List aria-label="Phần cấu hình">
              <Tabs.Tab value="weekly">Lịch hàng tuần</Tabs.Tab>
              <Tabs.Tab value="overrides">
                Ngày đặc biệt
                <Tabs.Count>{overrideDates}</Tabs.Count>
              </Tabs.Tab>
            </Tabs.List>
            <Tabs.Panel value="weekly" className="grid gap-3 pt-4">
              <SaveAlert
                code={code}
                failed={save.isError}
                partlySaved={partlySaved}
                badWindows={badWindows}
                otherErrors={badCount - badWindows.length}
                onReload={() => {
                  save.reset();
                  onReload();
                }}
              />
              <div ref={tableRef} className="min-w-0 overflow-x-auto">
                <WeeklySchedule
                  week={week}
                  openingHours={openingHours}
                  slotMinutes={rules.slotDurationMinutes}
                  errors={{ windows: windowErrors, capacity: clientErrors ? {} : serverErrors.capacity }}
                  mixedCapacity={mixedCapacity}
                  onDayChange={onDayChange}
                />
              </div>
              <p className="text-caption text-ink-muted">
                Giờ mở cửa lấy từ thông tin chi nhánh, sửa ở mục Chi nhánh. Ngày đặc biệt được ưu tiên hơn lịch hàng tuần. Giảm sức chứa
                không huỷ đơn đã đặt. Để trống tối đa đơn/ly để dùng mặc định.
              </p>
            </Tabs.Panel>
            <Tabs.Panel value="overrides" className="pt-4">
              <ScheduleOverrides branchId={branchId} overrides={schedule.schedule.overrides} onNotice={setNotice} onReload={onReload} />
            </Tabs.Panel>
          </Tabs.Root>
          <SlotPreview branchId={branchId} enabled={basis.config.isEnabled} />
        </div>
      </div>
    </div>
  );
}

function overbookedText(slot: OverbookedSlot) {
  const parts = [
    slot.maxOrders !== null && slot.usedOrders > slot.maxOrders ? `${slot.usedOrders} đơn / tối đa ${slot.maxOrders}` : null,
    slot.maxItems !== null && slot.usedItems > slot.maxItems ? `${slot.usedItems} ly / tối đa ${slot.maxItems}` : null,
  ].filter(Boolean);
  return `${formatIsoDate(slot.date)} ${slot.slotStart}–${slot.slotEnd}: ${parts.join("; ")}`;
}

interface SaveAlertProps {
  code: string | undefined;
  failed: boolean;
  partlySaved: boolean;
  badWindows: string[];
  otherErrors: number;
  onReload: () => void;
}

/** Why the last save did not (fully) go through, by Problem `code`. */
function SaveAlert({ code, failed, partlySaved, badWindows, otherErrors, onReload }: SaveAlertProps) {
  const prefix = partlySaved ? "Đã lưu quy tắc đặt trước, nhưng lịch tuần chưa lưu. " : "";
  if (badWindows.length > 0 || otherErrors > 0) {
    return (
      <FormAlert tone="danger">
        {prefix}
        {badWindows.length > 0 ? badWindows.join(" ") : "Có ô chưa hợp lệ, được đánh dấu bên dưới."} Bạn sửa lại trước khi lưu nhé.
      </FormAlert>
    );
  }
  if (!failed) return null;
  if (code === "VERSION_CONFLICT") {
    return (
      <div className="grid justify-items-start gap-2">
        <FormAlert tone="warning">
          {prefix}Khung giờ nhận đơn vừa được người khác cập nhật. Thay đổi của bạn chưa được lưu. Tải lại để xem bản mới rồi sửa tiếp.
        </FormAlert>
        <Button variant="outline" density="compact" onClick={onReload}>
          Tải lại
        </Button>
      </div>
    );
  }
  if (code === "BRANCH_INVALID_TRANSITION") {
    return <FormAlert tone="danger">Chi nhánh đã đóng nên không sửa được khung giờ nhận đơn nữa. Tải lại trang để xem trạng thái mới nhất.</FormAlert>;
  }
  return <FormAlert tone="danger">{prefix}Chưa lưu được. Bạn thử lại sau ít phút nhé.</FormAlert>;
}
