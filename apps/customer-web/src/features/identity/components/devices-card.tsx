"use client";

import { ApiError } from "@hayi/api-client";
import { formatBranchDayMonth, formatBranchTime } from "@hayi/domain-utils";
import { Button, Card, Dialog, Skeleton, StatusBadge } from "@hayi/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useId, useState } from "react";
import { errorCode, useCustomerApi } from "../../../lib/customer-api";
import { type DeviceSession, revokeSession, sessionsKey, sessionsQuery } from "../api/sessions";
import { deviceLabel } from "../device-label";

type Notice = { tone: "success" | "danger"; text: string } | null;

/**
 * D3f screen 11, "Thiết bị đang đăng nhập" (FE #74): this device first, then the others with their last use; another
 * device can be signed out after a confirmation. This one has no button: the page's own "Đăng xuất" ends it.
 */
export function DevicesCard() {
  const api = useCustomerApi();
  const queryClient = useQueryClient();
  const titleId = useId();
  const sessions = useQuery(sessionsQuery(api));
  const [confirming, setConfirming] = useState<DeviceSession | null>(null);
  const [notice, setNotice] = useState<Notice>(null);

  const revoke = useMutation({
    mutationFn: (session: DeviceSession) => revokeSession(api, session.sessionId),
    onSuccess: (_, session) => setNotice({ tone: "success", text: `Đã đăng xuất ${deviceLabel(session.userAgent)}.` }),
    onError: (error, session) =>
      setNotice(
        errorCode(error) === "SESSION_NOT_FOUND"
          ? { tone: "success", text: `${deviceLabel(session.userAgent)} đã đăng xuất trước đó.` }
          : {
              tone: "danger",
              text: error instanceof ApiError ? "Chưa đăng xuất được thiết bị. Bạn thử lại sau ít phút nhé." : "Không kết nối được máy chủ. Kiểm tra mạng rồi thử lại.",
            },
      ),
    onSettled: () => queryClient.invalidateQueries({ queryKey: sessionsKey }),
  });

  // This device first, then the most recently used (the API's order).
  const list = [...(sessions.data ?? [])].sort((a, b) => Number(b.current) - Number(a.current));

  return (
    <Card role="region" aria-labelledby={titleId} className="gap-0 p-0">
      <h2 id={titleId} className="px-4 pt-3.5 pb-2.5 text-body-lg font-semibold">
        Thiết bị đang đăng nhập
      </h2>
      {notice ? (
        <p
          role={notice.tone === "success" ? "status" : "alert"}
          className={
            notice.tone === "success"
              ? "mx-4 mb-3 rounded-md bg-success-soft px-3 py-2 text-body text-success"
              : "mx-4 mb-3 rounded-md bg-danger-soft px-3 py-2 text-body text-danger"
          }
        >
          {notice.text}
        </p>
      ) : null}
      {sessions.isError && !sessions.data ? (
        <div role="alert" className="grid justify-items-start gap-2 px-4 pb-4 text-body text-danger">
          Chưa tải được danh sách thiết bị.
          <Button variant="outline" density="compact" className="h-11" busy={sessions.isFetching} onClick={() => void sessions.refetch()}>
            Thử lại
          </Button>
        </div>
      ) : !sessions.data ? (
        <div className="px-4 pb-4">
          <Skeleton className="h-12 w-full" />
        </div>
      ) : (
        <ul>
          {list.map((session) => {
            const label = deviceLabel(session.userAgent);
            return (
              <li key={session.sessionId} className="flex items-center gap-3 border-t border-line px-4 py-3">
                <div className="grid min-w-0 flex-1">
                  <span className="text-body font-medium break-words">{label}</span>
                  <span className="text-caption text-ink-muted tabular-nums">
                    {session.current ? "Đang dùng" : `Dùng lần cuối ${formatBranchDayMonth(session.lastActiveAt)}, ${formatBranchTime(session.lastActiveAt)}`}
                  </span>
                </div>
                {session.current ? (
                  <StatusBadge tone="brand">Thiết bị này</StatusBadge>
                ) : (
                  <Button
                    variant="outline"
                    density="compact"
                    className="h-11"
                    aria-label={`Đăng xuất ${label}`}
                    busy={revoke.isPending && revoke.variables?.sessionId === session.sessionId}
                    onClick={() => {
                      setNotice(null);
                      setConfirming(session);
                    }}
                  >
                    Đăng xuất
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <Dialog.Root open={confirming !== null} onOpenChange={(open) => !open && setConfirming(null)}>
        <Dialog.Content className="w-[min(calc(100%-32px),400px)] p-6">
          <Dialog.Title>{`Đăng xuất ${deviceLabel(confirming?.userAgent ?? null)}?`}</Dialog.Title>
          <Dialog.Description className="text-ink">Thiết bị này sẽ phải đăng nhập lại để đặt món.</Dialog.Description>
          <Dialog.Actions>
            <Button variant="outline" onClick={() => setConfirming(null)}>
              Huỷ
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                if (confirming) revoke.mutate(confirming);
                setConfirming(null);
              }}
            >
              Đăng xuất
            </Button>
          </Dialog.Actions>
        </Dialog.Content>
      </Dialog.Root>
    </Card>
  );
}
