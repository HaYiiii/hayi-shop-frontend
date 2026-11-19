import { formatBranchTime } from "@hayi/domain-utils";
import { StatusBadge, cn, focusRing } from "@hayi/ui";
import Link from "next/link";
import type { ProductDetail } from "../option-selection";
import { ProductOptions } from "./product-options";

const blockedText = {
  SOLD_OUT: "Món này đang tạm hết ở chi nhánh. Bạn chọn món khác nhé.",
  PAUSED: "Món này đang tạm ngưng bán ở chi nhánh.",
} as const;

interface ProductDetailViewProps {
  product: ProductDetail;
  menuHref: string;
  /** When the product was evaluated (now): named in the "outside selling hours" banner, in Branch time. */
  now?: Date;
}

/** D3a screens 3 and 3b: image, name, description, then the choices (server prices per choice). */
export function ProductDetailView({ product, menuHref, now = new Date() }: ProductDetailViewProps) {
  const image = product.images.find((i) => i.isPrimary && i.url) ?? product.images.find((i) => i.url);
  const outside = product.availability === "OUTSIDE_SELLING_HOURS";
  const blocked = product.availability === "SOLD_OUT" || product.availability === "PAUSED" ? blockedText[product.availability] : null;

  return (
    <main className="mx-auto grid w-full max-w-content content-start bg-paper">
      <div className="relative h-49 bg-sunken">
        {image?.url ? (
          // Image hosts differ per environment (storage `publicUrl`); see branch-menu.tsx.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={image.url}
            alt={image.altText ?? product.name}
            width={640}
            height={196}
            fetchPriority="high"
            className={cn("h-49 w-full object-cover", (blocked || outside) && "opacity-55")}
          />
        ) : null}
        <Link
          href={menuHref}
          aria-label="Quay lại menu"
          className={cn("absolute top-3 left-3 grid size-11 place-items-center rounded-full bg-paper text-ink", focusRing)}
        >
          <svg aria-hidden="true" width="20" height="20" viewBox="0 0 20 20">
            <path d="M12.5 4.5 7 10l5.5 5.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </Link>
      </div>

      <div className="grid gap-4 p-4">
        <div className="grid gap-1">
          <h1 className="font-display text-display-lg text-balance">{product.name}</h1>
          {product.description ? <p className="text-body text-ink-muted whitespace-pre-line">{product.description}</p> : null}
        </div>
        {blocked ? (
          <div className="grid justify-items-start gap-2">
            <StatusBadge tone={product.availability === "SOLD_OUT" ? "danger" : "neutral"}>
              {product.availability === "SOLD_OUT" ? "Hết món" : "Tạm ngưng"}
            </StatusBadge>
            <p role="status" className="text-body text-ink-muted">
              {blocked}
            </p>
          </div>
        ) : (
          <>
            {outside ? <OutsideHours summary={product.sellingSchedule?.summary ?? null} now={now} /> : null}
            <ProductOptions product={product} locked={outside} />
          </>
        )}
      </div>
    </main>
  );
}

/**
 * D3a screen 3b: the product is outside its selling schedule now (AK3). The selling hours come as the API's
 * summary; changing the pickup time comes with S4 (agreed 2026-11-20).
 */
function OutsideHours({ summary, now }: { summary: string | null; now: Date }) {
  return (
    <div role="status" className="grid grid-cols-[auto_minmax(0,1fr)] items-start gap-x-3 gap-y-1 rounded-lg bg-warning-soft p-3 text-ink">
      <svg aria-hidden="true" width="20" height="20" viewBox="0 0 20 20" className="mt-px text-warning">
        <circle cx="10" cy="10" r="7.5" fill="none" stroke="currentColor" strokeWidth="1.6" />
        <path d="M10 6v4.2l2.8 1.8" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <div className="grid gap-0.5">
        <p className="text-body-lg font-semibold text-warning tabular-nums">{`Không bán lúc ${formatBranchTime(now.toISOString())} hôm nay`}</p>
        {summary ? <p className="text-body tabular-nums">{`Giờ bán: ${summary}.`}</p> : null}
      </div>
    </div>
  );
}
