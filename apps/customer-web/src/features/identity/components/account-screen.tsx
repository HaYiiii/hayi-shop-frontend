"use client";

import { ApiError } from "@hayi/api-client";
import { Button, Card, Field, Skeleton } from "@hayi/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { type FormEvent, useEffect, useId, useRef, useState } from "react";
import { errorCode, meKey, useCustomerApi } from "../../../lib/customer-api";
import { DISPLAY_NAME_MAX, type VersionedProfile, profileKey, profileQuery, renameProfile } from "../api/profile";
import { type CustomerMe, logOut, meQuery } from "../api/session";

const SIGN_IN = `/login?next=${encodeURIComponent("/account")}`;

/**
 * D3f screen 11, Tài khoản (FE #72): profile with an inline rename, and sign-out. Signed out → sign-in.
 * "Đổi mật khẩu" (#73) and the devices list (#74) come with their tickets (agreed 2026-11-22 on #72).
 */
export function AccountScreen() {
  const api = useCustomerApi();
  const queryClient = useQueryClient();
  const router = useRouter();
  const me = useQuery(meQuery(api));
  // Only a settled answer: a cached "signed out" may be refetching after a sign-in.
  const signedOut = me.isSuccess && me.data === null && !me.isFetching;
  // Signing out goes home, not to sign-in.
  const leaving = useRef(false);
  useEffect(() => {
    if (signedOut && !leaving.current) router.replace(SIGN_IN);
  }, [signedOut, router]);

  const logout = useMutation({
    mutationFn: async () => {
      try {
        await logOut(api);
      } catch (error) {
        // 401: the session is already gone, which is what signing out wants.
        if (!(error instanceof ApiError && error.status === 401)) throw error;
      }
    },
    // A refused refresh during sign-out also clears the session: home, not sign-in, from here on.
    onMutate: () => {
      leaving.current = true;
    },
    onError: () => {
      leaving.current = false;
    },
    // Only once the server has revoked the session: on a shared phone the cookies must not outlive "Đăng xuất".
    onSuccess: () => {
      queryClient.setQueryData(meKey, null);
      queryClient.removeQueries({ queryKey: profileKey });
      router.replace("/");
    },
  });

  if (me.isError) {
    return (
      <p role="alert" className="text-body text-danger">
        Chưa tải được tài khoản. Bạn thử lại sau ít phút nhé.
      </p>
    );
  }
  if (!me.data) return <Skeleton className="h-24 w-full" />;

  return (
    <div className="grid gap-4">
      <h1 className="font-display text-display-lg text-balance">Tài khoản</h1>
      <ProfileCard />
      {logout.isError ? (
        <p role="alert" className="rounded-md bg-danger-soft px-3 py-2.5 text-body text-danger">
          Chưa đăng xuất được. Bạn kiểm tra mạng rồi thử lại nhé.
        </p>
      ) : null}
      <Button variant="outline" block density="touch" className="text-danger" busy={logout.isPending} onClick={() => logout.mutate()}>
        Đăng xuất
      </Button>
    </div>
  );
}

type Notice = { tone: "success" | "danger" | "warning"; text: string } | null;

/** Profile (`GET /me/profile`) and "Sửa tên" in place (`PATCH /me/profile` with `If-Match`, API 07 §1). */
function ProfileCard() {
  const api = useCustomerApi();
  const queryClient = useQueryClient();
  const titleId = useId();
  const profile = useQuery(profileQuery(api));
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  // The version the edit was opened at; a 412 moves it to the newer one and keeps what was typed.
  const [base, setBase] = useState<VersionedProfile | null>(null);
  const [missing, setMissing] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice>(null);
  const editButton = useRef<HTMLButtonElement>(null);
  const nameInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) nameInput.current?.focus();
  }, [editing]);

  const save = useMutation({
    mutationFn: (name: string) => renameProfile(api, base!, name),
    onSuccess: (saved) => {
      queryClient.setQueryData(profileKey, saved);
      queryClient.setQueryData<CustomerMe | null>(meKey, (old) => (old ? { ...old, displayName: saved.profile.displayName } : old));
      setEditing(false);
      setNotice({ tone: "success", text: "Đã lưu tên." });
      requestAnimationFrame(() => editButton.current?.focus());
    },
    onError: async (error) => {
      if (errorCode(error) !== "VERSION_CONFLICT") {
        setNotice({ tone: "danger", text: "Chưa lưu được tên. Bạn thử lại sau ít phút nhé." });
        return;
      }
      try {
        const fresh = await queryClient.fetchQuery({ ...profileQuery(api), staleTime: 0 });
        setBase(fresh);
        setNotice({
          tone: "warning",
          text: `Tên vừa được đổi ở nơi khác (hiện là “${fresh.profile.displayName}”). Bấm Lưu để dùng tên bạn vừa nhập.`,
        });
      } catch {
        setNotice({ tone: "danger", text: "Chưa tải lại được hồ sơ. Bạn thử lại sau ít phút nhé." });
      }
    },
  });

  function open() {
    if (!profile.data) return;
    setBase(profile.data);
    setDraft(profile.data.profile.displayName);
    setMissing(null);
    setNotice(null);
    setEditing(true);
  }

  function cancel() {
    setEditing(false);
    setNotice(null);
    requestAnimationFrame(() => editButton.current?.focus());
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = draft.trim();
    const problem = !name ? "Nhập tên hiển thị." : name.length > DISPLAY_NAME_MAX ? `Tên tối đa ${DISPLAY_NAME_MAX} ký tự.` : null;
    setMissing(problem);
    if (problem) {
      nameInput.current?.focus();
      return;
    }
    setNotice(null);
    save.mutate(name);
  }

  const shown = profile.data?.profile;

  return (
    <Card role="region" aria-labelledby={titleId} className="gap-3 p-4">
      <h2 id={titleId} className="sr-only">
        Hồ sơ
      </h2>
      {notice ? (
        <p
          role={notice.tone === "success" ? "status" : "alert"}
          className={
            notice.tone === "success"
              ? "rounded-md bg-success-soft px-3 py-2 text-body text-success"
              : notice.tone === "warning"
                ? "rounded-md bg-warning-soft px-3 py-2 text-body text-warning"
                : "rounded-md bg-danger-soft px-3 py-2 text-body text-danger"
          }
        >
          {notice.text}
        </p>
      ) : null}
      {profile.isError ? (
        <p role="alert" className="text-body text-danger">
          Chưa tải được hồ sơ. Bạn thử lại sau ít phút nhé.
        </p>
      ) : !shown ? (
        <Skeleton className="h-12 w-full" />
      ) : editing ? (
        <form className="grid gap-3" onSubmit={submit} aria-label="Đổi tên" noValidate>
          <Field.Root>
            <Field.Label>Tên hiển thị</Field.Label>
            <Field.Input
              ref={nameInput}
              name="displayName"
              autoComplete="name"
              density="touch"
              maxLength={DISPLAY_NAME_MAX}
              value={draft}
              onChange={(e) => setDraft(e.currentTarget.value)}
            />
            {missing ? <Field.Error>{missing}</Field.Error> : null}
          </Field.Root>
          <div className="flex justify-end gap-2">
            <Button variant="outline" className="h-11" onClick={cancel}>
              Huỷ
            </Button>
            <Button type="submit" className="h-11" busy={save.isPending}>
              Lưu
            </Button>
          </div>
        </form>
      ) : (
        <div className="flex items-center gap-3">
          <span aria-hidden="true" className="grid size-12 shrink-0 place-items-center rounded-full bg-matcha-100 text-body-lg font-semibold text-matcha-700">
            {shown.displayName.trim().charAt(0).toUpperCase()}
          </span>
          <div className="grid min-w-0 flex-1">
            <span className="text-body-lg font-semibold break-words">{shown.displayName}</span>
            {shown.phoneMasked ? <span className="text-body text-ink-muted tabular-nums">{shown.phoneMasked}</span> : null}
          </div>
          <Button ref={editButton} variant="ghost" density="compact" className="h-11" onClick={open}>
            Sửa tên
          </Button>
        </div>
      )}
      <p className="text-caption text-ink-muted">Số điện thoại này dùng để đăng nhập.</p>
    </Card>
  );
}
