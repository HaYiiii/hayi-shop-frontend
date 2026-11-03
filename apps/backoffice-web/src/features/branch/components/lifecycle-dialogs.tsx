import { Button, Dialog, Field } from "@hayi/ui";
import { type ReactNode, useState } from "react";
import { errorCode } from "../../../lib/api";
import { FormAlert } from "../../../lib/form-alert";
import { openCommitmentsOf, useClosureCheck, useLifecycle } from "../hooks/use-lifecycle";
import type { Branch } from "../branch-form";
import { CommitmentList } from "./commitment-list";

interface DialogProps {
  branch: Branch;
  /** The command went through; the dialog closes. */
  onDone: (branch: Branch) => void;
  /** The Branch changed under the user: reload it and close. */
  onReload: () => void;
}

type Check = ReturnType<typeof useClosureCheck>;

/** Result of the closure-check: blocked with `conflicts[]`, or clear (Decision P3). */
function ClosureStatus({ check, branchId, blocked }: { check: Check; branchId: string; blocked: string }) {
  if (check.isError) return <FormAlert tone="danger">Chưa kiểm tra được đơn và phiên nhóm đang mở. Bạn bấm Kiểm tra lại nhé.</FormAlert>;
  if (!check.data) return <p className="text-body text-ink-muted">Đang kiểm tra đơn và phiên nhóm đang mở…</p>;
  if (check.data.length === 0) return <FormAlert tone="success">Đã kiểm tra: không còn đơn hay phiên nhóm đang mở.</FormAlert>;
  return (
    <div className="grid gap-2.5">
      <FormAlert tone="danger">{blocked}</FormAlert>
      <CommitmentList conflicts={check.data} branchId={branchId} />
      <p className="text-caption text-ink-muted">Hệ thống không tự chuyển đơn sang chi nhánh khác.</p>
    </div>
  );
}

function RecheckButton({ check }: { check: Check }) {
  return (
    <Button variant="outline" busy={check.isFetching} onClick={() => void check.refetch()}>
      Kiểm tra lại
    </Button>
  );
}

const cancel = (
  <Dialog.Close asChild>
    <Button variant="ghost">Hủy</Button>
  </Dialog.Close>
);

/** The status changed while the dialog was open (`409 BRANCH_INVALID_TRANSITION`). */
function InvalidTransition({ title, onReload }: { title: string; onReload: () => void }) {
  return (
    <Dialog.Content className={`${scroll} w-[min(calc(100%-32px),440px)]`}>
      <Dialog.Title>{title}</Dialog.Title>
      <Dialog.Description className="text-ink">
        Trạng thái chi nhánh đã thay đổi trong lúc bạn thao tác. Tải lại để xem trạng thái mới nhất.
      </Dialog.Description>
      <Dialog.Actions>
        <Button onClick={onReload}>Tải lại</Button>
      </Dialog.Actions>
    </Dialog.Content>
  );
}

/** Long content scrolls inside the dialog, never the page behind it. */
const scroll = "max-h-[calc(100dvh-32px)] overflow-y-auto overscroll-contain p-6";
const tall = `${scroll} w-[min(calc(100%-32px),480px)]`;

const unexpected = "Chưa thực hiện được. Bạn thử lại sau ít phút nhé.";

/** D3c screen 18: ACTIVE → INACTIVE, blocked while commitments are open. Render inside `<Dialog.Root>`. */
export function DeactivateDialog({ branch, onDone, onReload }: DialogProps) {
  const check = useClosureCheck(branch.branchId);
  const deactivate = useLifecycle(branch.branchId, "deactivate", onDone);
  const code = errorCode(deactivate.error);
  if (code === "BRANCH_INVALID_TRANSITION") return <InvalidTransition title="Không tạm ngưng được chi nhánh" onReload={onReload} />;
  const blocked = (check.data?.length ?? 0) > 0;

  return (
    <Dialog.Content className={tall}>
      <div className="grid gap-1">
        <Dialog.Title>{`Tạm ngưng ${branch.name}?`}</Dialog.Title>
        <Dialog.Description>
          Khách sẽ không thấy và không đặt được đơn mới ở chi nhánh này. Bạn mở lại được bất cứ lúc nào.
        </Dialog.Description>
      </div>
      <ClosureStatus
        check={check}
        branchId={branch.branchId}
        blocked="Chưa tạm ngưng được vì chi nhánh còn việc đang mở. Xử lý xong các mục dưới đây rồi kiểm tra lại."
      />
      {deactivate.isError && !openCommitmentsOf(deactivate.error) ? <FormAlert tone="danger">{unexpected}</FormAlert> : null}
      <Dialog.Actions>
        {cancel}
        {blocked || check.isError ? <RecheckButton check={check} /> : null}
        {check.data && !blocked ? (
          <Button busy={deactivate.isPending} onClick={() => deactivate.mutate()}>
            Tạm ngưng chi nhánh
          </Button>
        ) : null}
      </Dialog.Actions>
    </Dialog.Content>
  );
}

function CodeText({ children }: { children: ReactNode }) {
  return (
    <span translate="no" className="font-mono font-semibold tracking-wide">
      {children}
    </span>
  );
}

/**
 * D3c screen 19: → CLOSED for good. The button unlocks only when the code is typed again (owner decision);
 * the API client opens the step-up dialog on `403 STEP_UP_REQUIRED` and replays (API 01-security §8).
 */
export function CloseDialog({ branch, onDone, onReload }: DialogProps) {
  const check = useClosureCheck(branch.branchId);
  const close = useLifecycle(branch.branchId, "close", onDone);
  const [typed, setTyped] = useState("");
  const code = errorCode(close.error);
  if (code === "BRANCH_INVALID_TRANSITION") return <InvalidTransition title="Không đóng được chi nhánh" onReload={onReload} />;
  const blocked = (check.data?.length ?? 0) > 0;
  const matches = typed.trim().toUpperCase() === branch.branchCode;

  return (
    <Dialog.Content className={tall}>
      <div className="flex items-start gap-3">
        <span aria-hidden="true" className="grid size-10 shrink-0 place-items-center rounded-pill bg-danger-soft text-danger">
          <svg viewBox="0 0 20 20" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round">
            <path d="M10 3 18 17H2L10 3Z" />
            <path d="M10 8.5v3.5M10 14.6v.2" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        </span>
        <div className="grid min-w-0 gap-1">
          <Dialog.Title>{`Đóng vĩnh viễn ${branch.name}?`}</Dialog.Title>
          <Dialog.Description>Thao tác này không hoàn tác được.</Dialog.Description>
        </div>
      </div>
      <ul className="grid list-disc gap-1 pl-5 text-body">
        <li>Chi nhánh biến mất khỏi danh sách khách chọn.</li>
        <li>
          Không kích hoạt lại được. Mã <CodeText>{branch.branchCode}</CodeText> không dùng lại được.
        </li>
        <li>Lịch sử đơn và báo cáo vẫn được giữ.</li>
      </ul>
      <ClosureStatus
        check={check}
        branchId={branch.branchId}
        blocked="Chưa đóng được vì chi nhánh còn việc đang mở. Xử lý xong các mục dưới đây rồi kiểm tra lại."
      />
      {code === "STEP_UP_REQUIRED" ? (
        <FormAlert tone="danger">Cần xác thực lại để đóng chi nhánh. Bấm Đóng chi nhánh để thử lại.</FormAlert>
      ) : close.isError && !openCommitmentsOf(close.error) ? (
        <FormAlert tone="danger">{unexpected}</FormAlert>
      ) : null}
      <Field.Root>
        <Field.Label>
          Gõ <CodeText>{branch.branchCode}</CodeText> để xác nhận
        </Field.Label>
        <Field.Input
          name="confirmCode"
          value={typed}
          onChange={(event) => setTyped(event.target.value)}
          autoComplete="off"
          spellCheck={false}
          translate="no"
          className="font-mono uppercase"
        />
        <Field.Hint>Nút đóng chỉ mở khi mã khớp hoàn toàn.</Field.Hint>
      </Field.Root>
      <Dialog.Actions>
        {cancel}
        {blocked || check.isError ? (
          <RecheckButton check={check} />
        ) : (
          <Button variant="danger" disabled={!matches || !check.data} busy={close.isPending} onClick={() => close.mutate()}>
            Đóng chi nhánh
          </Button>
        )}
      </Dialog.Actions>
    </Dialog.Content>
  );
}
