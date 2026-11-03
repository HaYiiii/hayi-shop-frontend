import { formatBranchDate } from "@hayi/domain-utils";
import { Button, Card, Dialog, Skeleton, StatusBadge, cn, focusRing } from "@hayi/ui";
import { useQuery } from "@tanstack/react-query";
import { Link, useMatchRoute } from "@tanstack/react-router";
import { type ReactNode, createContext, use, useState } from "react";
import { errorCode, useApi } from "../../../lib/api";
import { FormAlert } from "../../../lib/form-alert";
import { type LifecycleCommand, branchQuery } from "../api/branches";
import { useLifecycle } from "../hooks/use-lifecycle";
import type { Branch } from "../branch-form";
import { lifecycleCommands, statusLabel, statusTone } from "../branch-status";
import { BranchInfoForm } from "./branch-info-form";
import { Breadcrumb } from "./breadcrumb";
import { CloseDialog, DeactivateDialog } from "./lifecycle-dialogs";

export type Notice = { tone: "success" | "danger"; text: string; reload?: boolean };

interface BranchPageValue {
  branch: Branch;
  /** One message area for the page: lifecycle commands and the section's own saves. */
  setNotice: (notice: Notice | null) => void;
  /** Reload the Branch (and clear the message). */
  reload: () => void;
}

const BranchPageContext = createContext<BranchPageValue | null>(null);

/** The Branch of the page and its message area, for a section inside `<BranchPage>`. */
export function useBranchPage(): BranchPageValue {
  const value = use(BranchPageContext);
  if (!value) throw new Error("useBranchPage must be used inside <BranchPage>");
  return value;
}

const tabClass = cn(
  "-mb-px rounded-t-md border-b-2 border-transparent px-3 py-2 text-body font-medium text-ink-muted no-underline hover:text-ink",
  "aria-[current=page]:border-matcha-700 aria-[current=page]:font-semibold aria-[current=page]:text-matcha-800",
  focusRing,
);

/** D3c screens 16–17: a Branch's header, lifecycle commands and section tabs around the open section. */
export function BranchPage({ branchId, children }: { branchId: string; children: ReactNode }) {
  const api = useApi();
  const matchRoute = useMatchRoute();
  const { data: branch, error, refetch, isFetching } = useQuery(branchQuery(api, branchId));
  const [notice, setNotice] = useState<Notice | null>(null);

  if (!branch) {
    if (error) {
      const missing = errorCode(error) === "BRANCH_NOT_FOUND";
      return (
        <>
          <Breadcrumb current="Chi tiết" />
          <div className="grid justify-items-start gap-2">
            <FormAlert tone="danger">
              {missing ? "Không tìm thấy chi nhánh này. Quay lại danh sách để chọn chi nhánh khác." : "Chưa tải được chi nhánh. Kiểm tra mạng rồi thử lại."}
            </FormAlert>
            {missing ? null : (
              <Button variant="outline" busy={isFetching} onClick={() => void refetch()}>
                Thử lại
              </Button>
            )}
          </div>
        </>
      );
    }
    return <Skeleton className="h-80 w-full max-w-[760px]" />;
  }

  const reload = () => {
    setNotice(null);
    void refetch();
  };
  const onHours = Boolean(matchRoute({ to: "/admin/branches/$id/hours", params: { id: branchId } }));
  const params = { id: branch.branchId };

  return (
    <BranchPageContext value={{ branch, setNotice, reload }}>
      {onHours ? <Breadcrumb branch={{ id: branch.branchId, name: branch.name }} current="Giờ mở cửa" /> : <Breadcrumb current={branch.name} />}
      <section aria-label="Tóm tắt chi nhánh" className="flex flex-wrap items-center gap-3">
        <h1 className="font-display text-heading-lg text-balance">{branch.name}</h1>
        <span translate="no" className="font-mono text-label font-semibold tracking-wide text-ink-muted">
          {branch.branchCode}
        </span>
        <StatusBadge tone={statusTone[branch.status]} dot>
          {statusLabel[branch.status]}
        </StatusBadge>
        <LifecycleActions branch={branch} onNotice={setNotice} onReload={reload} />
      </section>

      <nav aria-label="Phần chi nhánh" className="flex gap-1 border-b border-line">
        <Link to="/admin/branches/$id" params={params} activeOptions={{ exact: true }} className={tabClass} onClick={() => setNotice(null)}>
          Thông tin
        </Link>
        <Link to="/admin/branches/$id/hours" params={params} className={tabClass} onClick={() => setNotice(null)}>
          Giờ mở cửa
        </Link>
        {/* A Branch screen switches the working scope to this Branch: fine for a DRAFT (slots are set up
            before activating) or an operating one, not for a CLOSED Branch. */}
        {branch.status === "CLOSED" ? null : (
          <Link to="/branches/$branchId/slots" params={{ branchId: branch.branchId }} className={tabClass}>
            Khung giờ nhận đơn
          </Link>
        )}
      </nav>

      {notice ? (
        <div className="grid max-w-[760px] justify-items-start gap-2">
          <FormAlert tone={notice.tone}>{notice.text}</FormAlert>
          {notice.reload ? (
            <Button variant="outline" density="compact" onClick={reload}>
              Tải lại
            </Button>
          ) : null}
        </div>
      ) : null}

      {children}
    </BranchPageContext>
  );
}

/** D3c screen 16: name, address, contact and lifecycle facts. */
export function BranchInfo() {
  const { branch, setNotice, reload } = useBranchPage();
  return (
    <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,760px)_minmax(0,1fr)]">
      <BranchInfoForm
        // A new version (save, reload, transition) resets the fields to the server's values.
        key={branch.version}
        branch={branch}
        onSaved={(changed) =>
          setNotice({ tone: "success", text: changed ? "Đã lưu thông tin chi nhánh." : "Không có thay đổi nào để lưu." })
        }
        onReload={reload}
      />
      <LifecycleFacts branch={branch} />
    </div>
  );
}

const doneText: Record<LifecycleCommand, string> = {
  activate: "Đã kích hoạt chi nhánh.",
  deactivate: "Đã tạm ngưng chi nhánh.",
  close: "Đã đóng chi nhánh.",
};

interface ActionsProps {
  branch: Branch;
  onNotice: (notice: Notice | null) => void;
  onReload: () => void;
}

/** Commands for the current status (Branch §4.3); deactivate and close confirm in a dialog. */
function LifecycleActions({ branch, onNotice, onReload }: ActionsProps) {
  const commands = lifecycleCommands[branch.status];
  return (
    <div role="group" aria-label="Thao tác vòng đời" className="ml-auto flex flex-wrap gap-2">
      {commands.map((command) =>
        command === "activate" ? (
          <ActivateButton key={command} branch={branch} onNotice={onNotice} />
        ) : (
          <ConfirmCommand key={command} command={command} branch={branch} onNotice={onNotice} onReload={onReload} />
        ),
      )}
    </div>
  );
}

function ActivateButton({ branch, onNotice }: Omit<ActionsProps, "onReload">) {
  const activate = useLifecycle(branch.branchId, "activate", () => onNotice({ tone: "success", text: doneText.activate }));
  return (
    <Button
      busy={activate.isPending}
      onClick={() => {
        onNotice(null);
        activate.mutate(undefined, {
          onError: (error) =>
            onNotice(
              errorCode(error) === "BRANCH_INVALID_TRANSITION"
                ? { tone: "danger", text: "Trạng thái chi nhánh đã thay đổi trong lúc bạn thao tác. Tải lại để xem trạng thái mới nhất.", reload: true }
                : { tone: "danger", text: "Chưa kích hoạt được. Bạn thử lại sau ít phút nhé." },
            ),
        });
      }}
    >
      Kích hoạt
    </Button>
  );
}

function ConfirmCommand({ command, branch, onNotice, onReload }: ActionsProps & { command: "deactivate" | "close" }) {
  const [open, setOpen] = useState(false);
  const props = {
    branch,
    onDone: () => {
      setOpen(false);
      onNotice({ tone: "success", text: doneText[command] });
    },
    onReload: () => {
      setOpen(false);
      onReload();
    },
  };
  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <Button variant={command === "close" ? "danger" : "outline"} onClick={() => onNotice(null)}>
          {command === "close" ? "Đóng chi nhánh…" : "Tạm ngưng…"}
        </Button>
      </Dialog.Trigger>
      {open ? command === "close" ? <CloseDialog {...props} /> : <DeactivateDialog {...props} /> : null}
    </Dialog.Root>
  );
}

const lifecycleSteps = ["DRAFT", "ACTIVE", "INACTIVE", "CLOSED"] as const;
const lifecycleArrows = ["→", "⇄", "→"];

function LifecycleFacts({ branch }: { branch: Branch }) {
  const date = (instant: string | null) => (instant ? formatBranchDate(instant, branch.timezone) : "—");
  return (
    <Card aria-labelledby="branch-lifecycle-title" className="gap-3 p-5" role="complementary">
      <h2 id="branch-lifecycle-title" className="text-body-lg font-semibold">
        Vòng đời
      </h2>
      <p className="flex flex-wrap items-center gap-2 text-label text-ink-muted">
        {lifecycleSteps.map((step, i) => (
          <span key={step} className="contents">
            {step === branch.status ? <b className="text-ink">{statusLabel[step]}</b> : <span>{statusLabel[step]}</span>}
            {lifecycleArrows[i] ? <span aria-hidden="true">{lifecycleArrows[i]}</span> : null}
          </span>
        ))}
      </p>
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-label font-normal tabular-nums">
        <dt className="text-ink-muted">Kích hoạt</dt>
        <dd>{date(branch.activatedAt)}</dd>
        <dt className="text-ink-muted">Tạo lúc</dt>
        <dd>{date(branch.createdAt)}</dd>
        {branch.closedAt ? (
          <>
            <dt className="text-ink-muted">Đóng lúc</dt>
            <dd>{date(branch.closedAt)}</dd>
          </>
        ) : null}
      </dl>
      <p className="text-caption text-ink-muted">
        Tạm ngưng: khách không đặt mới, mở lại được. Đóng: vĩnh viễn. Cả hai bị chặn khi còn đơn hoặc phiên nhóm đang mở.
      </p>
    </Card>
  );
}
