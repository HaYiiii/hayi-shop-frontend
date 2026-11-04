import { Button, Skeleton } from "@hayi/ui";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { FormAlert } from "../../../lib/form-alert";
import { hoursKey } from "../api/hours";
import { useHours } from "../hooks/use-hours";
import { useBranchPage } from "./branch-detail";
import { HourOverrides } from "./hour-overrides";
import { WeeklyHours } from "./weekly-hours";

/** D3c screen 17: weekly hours and special days (Branch §4.4, API 09 §1.4). */
export function BranchHours() {
  const queryClient = useQueryClient();
  const { branch } = useBranchPage();
  const { data, error, refetch, isFetching } = useHours(branch.branchId);
  const [weeklyRound, setWeeklyRound] = useState(0);
  // CLOSED is terminal: the API answers 409 to any edit (Decision Q1).
  const readOnly = branch.status === "CLOSED";

  if (!data) {
    if (error) {
      return (
        <div className="grid justify-items-start gap-2">
          <FormAlert tone="danger">Chưa tải được giờ mở cửa. Kiểm tra mạng rồi thử lại.</FormAlert>
          <Button variant="outline" busy={isFetching} onClick={() => void refetch()}>
            Thử lại
          </Button>
        </div>
      );
    }
    return <Skeleton className="h-96 w-full" />;
  }

  const reload = () => void queryClient.invalidateQueries({ queryKey: hoursKey(branch.branchId) });
  // Only "Tải lại" after a 412 throws the weekly edits away: the editor starts again from the fetched week.
  const reloadWeekly = async () => {
    await queryClient.refetchQueries({ queryKey: hoursKey(branch.branchId) });
    setWeeklyRound((n) => n + 1);
  };

  return (
    <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
      {readOnly ? (
        <p className="text-label font-normal text-ink-muted xl:col-span-2">Chi nhánh đã đóng nên không sửa được giờ mở cửa.</p>
      ) : null}
      <WeeklyHours
        key={weeklyRound}
        branchId={branch.branchId}
        weekly={data.hours.weekly}
        version={data.version}
        readOnly={readOnly}
        onReload={() => void reloadWeekly()}
      />
      <HourOverrides branchId={branch.branchId} overrides={data.hours.overrides} readOnly={readOnly} onReload={reload} />
    </div>
  );
}
