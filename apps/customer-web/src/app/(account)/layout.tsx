import type { ReactNode } from "react";
import { CustomerProviders } from "../../lib/customer-api";

/** Pages with a Customer session: they call `/api/customer` from the browser (API 01-security §2). */
export default function AccountLayout({ children }: { children: ReactNode }) {
  return <CustomerProviders>{children}</CustomerProviders>;
}
