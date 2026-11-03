import { formatBranchDate } from "@hayi/domain-utils";
import { Button, Chip, ChipGroup, Skeleton, StatusBadge, Table } from "@hayi/ui";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useApi } from "../../../lib/api";
import { FormAlert } from "../../../lib/form-alert";
import { branchesQuery } from "../api/branches";
import type { Branch, BranchStatus } from "../branch-form";
import { statusLabel, statusOrder, statusTone } from "../branch-status";

export function addressText(branch: Branch): string {
  const { line, ward, district, province } = branch.address;
  return [line, ward, district, province].filter(Boolean).join(", ");
}

interface BranchListProps {
  /** Status filter from the URL; `undefined` = all. */
  status: BranchStatus | undefined;
  onStatusChange: (status: BranchStatus | undefined) => void;
}

/** D3c screen 14: every Branch, filtered by status on the client (the list is small, API 09 §1.1). */
export function BranchList({ status, onStatusChange }: BranchListProps) {
  const api = useApi();
  const { data: branches, error, refetch, isFetching } = useQuery(branchesQuery(api));

  return (
    <>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="font-display text-heading-lg text-balance">Chi nhánh</h1>
        {branches ? <span className="text-body text-ink-muted tabular-nums">{branches.length} chi nhánh</span> : null}
        <Button asChild className="ml-auto no-underline">
          <Link to="/admin/branches/new">Tạo chi nhánh</Link>
        </Button>
      </div>

      {error ? (
        <div className="grid justify-items-start gap-2">
          <FormAlert tone="danger">Chưa tải được danh sách chi nhánh. Kiểm tra mạng rồi thử lại.</FormAlert>
          <Button variant="outline" busy={isFetching} onClick={() => void refetch()}>
            Thử lại
          </Button>
        </div>
      ) : !branches ? (
        <Skeleton className="h-60 w-full" />
      ) : (
        <BranchTable branches={branches} status={status} onStatusChange={onStatusChange} />
      )}

      <p className="text-caption text-ink-muted">
        Chi nhánh mới tạo ở trạng thái Nháp, khách chưa thấy cho đến khi kích hoạt. Chi nhánh đã đóng không mở lại được và
        mã của nó không dùng lại.
      </p>
    </>
  );
}

function BranchTable({ branches, status, onStatusChange }: BranchListProps & { branches: Branch[] }) {
  const count = (s: BranchStatus) => branches.filter((b) => b.status === s).length;
  const shown = status ? branches.filter((b) => b.status === status) : branches;

  return (
    <>
      <ChipGroup aria-label="Lọc theo trạng thái">
        <Chip pressed={status === undefined} onClick={() => onStatusChange(undefined)}>
          {`Tất cả · ${branches.length}`}
        </Chip>
        {statusOrder.map((s) => (
          <Chip key={s} pressed={status === s} onClick={() => onStatusChange(s)}>
            {`${statusLabel[s]} · ${count(s)}`}
          </Chip>
        ))}
      </ChipGroup>

      {shown.length === 0 ? (
        <p role="status" className="rounded-lg border border-dashed border-line-strong bg-paper p-6 text-center text-body text-ink-muted">
          Không có chi nhánh nào ở trạng thái này.
        </p>
      ) : (
        <Table.Root aria-label="Danh sách chi nhánh">
          <Table.Head>
            <Table.Row>
              <Table.HeaderCell>Mã</Table.HeaderCell>
              <Table.HeaderCell>Tên</Table.HeaderCell>
              <Table.HeaderCell>Địa chỉ</Table.HeaderCell>
              <Table.HeaderCell>Trạng thái</Table.HeaderCell>
              <Table.HeaderCell>Kích hoạt</Table.HeaderCell>
              <Table.HeaderCell>
                <span className="sr-only">Mở</span>
              </Table.HeaderCell>
            </Table.Row>
          </Table.Head>
          <Table.Body>
            {shown.map((branch) => {
              const closed = branch.status === "CLOSED";
              return (
                <Table.Row key={branch.branchId} className={closed ? "text-ink-muted" : undefined}>
                  <Table.Cell translate="no" className="font-mono text-label font-semibold tracking-wide">
                    {branch.branchCode}
                  </Table.Cell>
                  <Table.Cell className="font-semibold">{branch.name}</Table.Cell>
                  <Table.Cell className="text-ink-muted">{addressText(branch)}</Table.Cell>
                  <Table.Cell>
                    <StatusBadge tone={statusTone[branch.status]} dot>
                      {statusLabel[branch.status]}
                    </StatusBadge>
                  </Table.Cell>
                  <Table.Cell className={branch.activatedAt ? undefined : "text-ink-muted"}>
                    {branch.activatedAt ? formatBranchDate(branch.activatedAt, branch.timezone) : "—"}
                  </Table.Cell>
                  <Table.Cell className="text-right">
                    <Link
                      to="/admin/branches/$id"
                      params={{ id: branch.branchId }}
                      aria-label={`Xem ${branch.name}`}
                      className="rounded-sm font-medium text-matcha-700 hover:text-matcha-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
                    >
                      Xem
                    </Link>
                  </Table.Cell>
                </Table.Row>
              );
            })}
          </Table.Body>
        </Table.Root>
      )}
    </>
  );
}
