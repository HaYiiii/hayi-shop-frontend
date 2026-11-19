import { StatusBadge, cn, focusRing } from "@hayi/ui";
import Link from "next/link";
import type { ProductDetail } from "../option-selection";
import { ProductOptions } from "./product-options";

const blockedText = {
  SOLD_OUT: "Món này đang tạm hết ở chi nhánh. Bạn chọn món khác nhé.",
  PAUSED: "Món này đang tạm ngưng bán ở chi nhánh.",
  OUTSIDE_SELLING_HOURS: "Món này chưa tới giờ bán ở chi nhánh.",
} as const;

/** D3a screen 3: image, name, description, then the choices (server prices per choice). */
export function ProductDetailView({ product, menuHref }: { product: ProductDetail; menuHref: string }) {
  const image = product.images.find((i) => i.isPrimary && i.url) ?? product.images.find((i) => i.url);
  const blocked = product.availability === "AVAILABLE" ? null : blockedText[product.availability];

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
            className={cn("h-49 w-full object-cover", blocked && "opacity-55")}
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
              {product.availability === "SOLD_OUT" ? "Hết món" : product.availability === "PAUSED" ? "Tạm ngưng" : "Ngoài giờ bán"}
            </StatusBadge>
            <p role="status" className="text-body text-ink-muted">
              {blocked}
            </p>
          </div>
        ) : (
          <ProductOptions product={product} />
        )}
      </div>
    </main>
  );
}
