"use client";

import { ApiError } from "@hayi/api-client";
import { Button, Skeleton } from "@hayi/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { meKey, useCustomerApi } from "../../../lib/customer-api";
import { logOut, meQuery } from "../api/session";

const SIGN_IN = `/login?next=${encodeURIComponent("/account")}`;

/** Tab "Tài khoản" (FE #70): signed out → sign-in; signed in → name, phone and sign-out. Screen 11 comes in #72. */
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
    <section className="grid gap-4">
      <div className="grid gap-1">
        <h1 className="font-display text-heading-lg text-balance">{`Chào ${me.data.displayName ?? "bạn"}`}</h1>
        {me.data.phoneMasked ? <p className="text-body text-ink-muted tabular-nums">{me.data.phoneMasked}</p> : null}
      </div>
      {logout.isError ? (
        <p role="alert" className="rounded-md bg-danger-soft px-3 py-2.5 text-body text-danger">
          Chưa đăng xuất được. Bạn kiểm tra mạng rồi thử lại nhé.
        </p>
      ) : null}
      <Button variant="outline" block density="touch" busy={logout.isPending} onClick={() => logout.mutate()}>
        Đăng xuất
      </Button>
    </section>
  );
}
