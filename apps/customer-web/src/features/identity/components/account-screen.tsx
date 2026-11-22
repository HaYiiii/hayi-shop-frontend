"use client";

import { Button, Skeleton } from "@hayi/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { meKey, useCustomerApi } from "../../../lib/customer-api";
import { logOut, meQuery } from "../api/session";

const SIGN_IN = `/login?next=${encodeURIComponent("/account")}`;

/** Tab "Tài khoản" (FE #70): signed out → sign-in; signed in → name, phone and sign-out. Screen 11 comes in #72. */
export function AccountScreen() {
  const api = useCustomerApi();
  const queryClient = useQueryClient();
  const router = useRouter();
  const me = useQuery(meQuery(api));
  const signedOut = me.isSuccess && me.data === null;
  useEffect(() => {
    if (signedOut) router.replace(SIGN_IN);
  }, [signedOut, router]);

  const logout = useMutation({
    mutationFn: () => logOut(api),
    // Signed out locally even if the request failed: the cookies are the only token and the server revokes on expiry.
    onSettled: () => {
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
      <Button variant="outline" block density="touch" busy={logout.isPending} onClick={() => logout.mutate()}>
        Đăng xuất
      </Button>
    </section>
  );
}
