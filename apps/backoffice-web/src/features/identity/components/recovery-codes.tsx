import { Button, Card, StatusBadge } from "@hayi/ui";
import { useEffect, useId, useMemo, useState } from "react";
import { AuthLayout, AuthTitle } from "./auth-layout";
import { CopyButton } from "./copy-button";
import { FormAlert } from "./form-alert";

/** Recovery codes are shown once (API 01-security §6.2); they live only in memory. */
export function RecoveryCodes({ codes, onContinue }: { codes: string[]; onContinue: () => void }) {
  const [saved, setSaved] = useState(false);
  const titleId = useId();
  const hintId = useId();
  const text = codes.join("\n");
  const fileUrl = useMemo(() => URL.createObjectURL(new Blob([`${text}\n`], { type: "text/plain" })), [text]);
  useEffect(() => () => URL.revokeObjectURL(fileUrl), [fileUrl]);

  return (
    <AuthLayout width="medium">
      <div className="grid gap-2">
        <StatusBadge tone="success" dot className="justify-self-start">
          Đã bật xác thực 2 lớp
        </StatusBadge>
        <AuthTitle>Lưu mã khôi phục</AuthTitle>
        <p className="text-body text-ink-muted">
          Khi mất điện thoại, mỗi mã dưới đây dùng được một lần thay cho mã xác thực.
        </p>
      </div>

      <Card className="gap-4 p-6" role="region" aria-labelledby={titleId}>
        <h2 id={titleId} className="text-title">
          {codes.length} mã khôi phục
        </h2>
        <FormAlert tone="warning">
          Mã chỉ hiển thị một lần. Lưu vào trình quản lý mật khẩu hoặc in ra cất ở nơi an toàn.
        </FormAlert>
        <ul
          translate="no"
          className="grid grid-cols-2 gap-x-6 gap-y-2 rounded-md bg-sunken p-4 font-mono text-body-lg font-medium tracking-wide"
        >
          {codes.map((code) => (
            <li key={code}>{code}</li>
          ))}
        </ul>
        <div className="flex flex-wrap gap-2">
          <CopyButton text={text} label="Sao chép tất cả" />
          <Button asChild variant="outline">
            <a href={fileUrl} download="hayi-backoffice-recovery-codes.txt">
              Tải tệp .txt
            </a>
          </Button>
        </div>
        <label className="flex min-h-11 cursor-pointer items-center gap-3 text-body font-medium">
          <input
            type="checkbox"
            checked={saved}
            onChange={(e) => setSaved(e.target.checked)}
            className="size-5 accent-matcha-700"
          />
          Tôi đã lưu các mã ở nơi an toàn
        </label>
        <Button block disabled={!saved} onClick={onContinue} aria-describedby={hintId}>
          Vào Backoffice
        </Button>
        <p id={hintId} className="text-caption text-ink-subtle">
          Nút mở khi bạn đánh dấu đã lưu mã.
        </p>
      </Card>
    </AuthLayout>
  );
}
