import { formatVnd } from "@hayi/domain-utils";
import { StatusBadge, cn, focusRing } from "@hayi/ui";
import Link from "next/link";
import type { PublicBranch } from "../../branch/api/branches";
import { pickupText } from "../../branch/pickup-text";
import type { MenuProduct, PublicMenu } from "../api/menu";
import { availabilityText, menuCollections, menuJumps, menuSections } from "../menu-sections";

interface BranchMenuProps {
  branch: PublicBranch;
  menu: PublicMenu;
  now?: Date;
}

/**
 * D3a screen 2: a Branch's menu by Category, with a sticky bar that jumps to each root Category.
 * Server-rendered (no client JS): the bar is plain links to anchors.
 */
export function BranchMenu({ branch, menu, now = new Date() }: BranchMenuProps) {
  const sections = menuSections(menu);
  const jumps = menuJumps(menu);
  const pickup = pickupText(branch.earliestPickupAt, now);
  const collections = menuCollections(menu);
  const productHref = (product: MenuProduct) => `/b/${encodeURIComponent(branch.branchCode)}/p/${encodeURIComponent(product.slug)}`;

  return (
    <>
      <header className="sticky top-0 z-10 grid gap-2.5 border-b border-line bg-paper px-4 pt-3">
        <div className="mx-auto flex w-full max-w-content flex-wrap items-center gap-x-3 gap-y-1">
          <Link
            href="/"
            className={cn("grid min-h-11 min-w-0 content-center rounded-md text-ink no-underline", focusRing)}
            aria-label={`Lấy tại ${branch.name}. Đổi chi nhánh`}
          >
            <span className="text-caption text-ink-muted">Lấy tại</span>
            <span className="text-body font-semibold break-words">
              {branch.name} <span aria-hidden="true">▾</span>
            </span>
          </Link>
          <span className={cn("ml-auto text-label tabular-nums", pickup.today ? "font-medium" : "text-ink-muted")}>{pickup.text}</span>
        </div>
        {jumps.length > 0 ? (
          <nav aria-label="Danh mục" className="mx-auto w-full max-w-content">
            <ul className="-mx-1 flex gap-1 overflow-x-auto overscroll-x-contain">
              {jumps.map((jump) => (
                <li key={jump.anchor} className="shrink-0">
                  <a
                    href={`#${jump.anchor}`}
                    className={cn(
                      "inline-flex min-h-11 items-center px-3 text-body font-medium whitespace-nowrap text-ink-muted no-underline hover:text-ink",
                      focusRing,
                    )}
                  >
                    {jump.name}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        ) : null}
      </header>

      <main className="mx-auto grid w-full max-w-content gap-6 px-4 py-4">
        <h1 className="sr-only">{`Menu ${branch.name}`}</h1>
        {collections.map((collection) => (
          <section key={collection.collectionId} aria-labelledby={collection.anchor} className="grid gap-3">
            <div className="grid gap-0.5">
              <h2 id={collection.anchor} className="font-display text-heading-lg text-balance">
                {collection.name}
              </h2>
              <p className="text-caption text-ink-muted">{`Bộ sưu tập · ${collection.products.length} món`}</p>
            </div>
            <ul aria-label={`Món ${collection.name}`} className="-mx-4 flex snap-x scroll-px-4 gap-3 overflow-x-auto overscroll-x-contain px-4 pb-1">
              {collection.products.map((product) => (
                <li key={product.productId} className="w-36 shrink-0 snap-start">
                  <CollectionTile product={product} evaluatedAt={menu.evaluatedAt} href={productHref(product)} />
                </li>
              ))}
            </ul>
          </section>
        ))}
        {sections.length === 0 ? (
          <p className="text-body text-ink-muted">Chi nhánh chưa có món nào đang bán. Bạn chọn chi nhánh khác hoặc quay lại sau nhé.</p>
        ) : (
          sections.map((section) =>
            section.products.length === 0 && section.level === 2 ? null : (
              <section key={section.categoryId} aria-labelledby={section.anchor} className="grid scroll-mt-32 gap-3">
                {section.level === 1 ? (
                  <h2 id={section.anchor} className="scroll-mt-32 font-display text-heading-lg text-balance">
                    {section.name}
                  </h2>
                ) : (
                  <h3 id={section.anchor} className="scroll-mt-32 text-title text-balance">
                    {section.name}
                  </h3>
                )}
                {section.products.length > 0 ? (
                  <ul className="grid gap-3" aria-label={`Món ${section.name}`}>
                    {section.products.map((product) => (
                      <li key={product.productId}>
                        <ProductCard product={product} evaluatedAt={menu.evaluatedAt} href={productHref(product)} />
                      </li>
                    ))}
                  </ul>
                ) : null}
              </section>
            ),
          )
        )}
      </main>
    </>
  );
}

/** One product (D3a screen 2 card), opening its page (D3a screen 3, FE #52). */
function ProductCard({ product, evaluatedAt, href }: { product: MenuProduct; evaluatedAt: string; href: string }) {
  const unavailable = availabilityText(product.availability, evaluatedAt);
  return (
    <Link
      href={href}
      className={cn(
        "grid grid-cols-[88px_minmax(0,1fr)] gap-3 rounded-lg border border-line bg-paper p-3 text-ink no-underline transition-colors hover:border-ink-muted",
        unavailable && "bg-sunken",
        focusRing,
      )}
    >
      {product.primaryImageUrl ? (
        // Image hosts differ per environment (storage `publicUrl`, Decision AG); `next/image` would need them
        // configured as remotePatterns. Plain `<img>` at its display size, lazy, until a CDN host is fixed.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={product.primaryImageUrl}
          alt=""
          width={88}
          height={88}
          loading="lazy"
          decoding="async"
          className={cn("size-22 rounded-md bg-sunken object-cover", unavailable && "opacity-55")}
        />
      ) : (
        <span aria-hidden="true" className="size-22 rounded-md bg-sunken" />
      )}
      <div className="grid min-w-0 content-start gap-2">
        <p className={cn("text-body-lg font-semibold break-words", unavailable && "text-ink-muted")}>{product.name}</p>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-body font-semibold tabular-nums">{`Từ ${formatVnd(product.fromPrice)}`}</span>
          {unavailable ? (
            <StatusBadge tone={badgeTone(product.availability)}>{unavailable}</StatusBadge>
          ) : null}
        </div>
        {product.tags.length > 0 ? (
          <span className="flex flex-wrap gap-1">
            {product.tags.map((tag) => (
              <StatusBadge key={tag.slug} tone="neutral">
                {tag.name}
              </StatusBadge>
            ))}
          </span>
        ) : null}
      </div>
    </Link>
  );
}

function badgeTone(availability: MenuProduct["availability"]) {
  return availability === "SOLD_OUT" ? "danger" : availability === "OUTSIDE_SELLING_HOURS" ? "warning" : "neutral";
}

/** A Collection tile (D3a screen 2b): image, name, "Từ" price, and why it cannot be ordered now. */
function CollectionTile({ product, evaluatedAt, href }: { product: MenuProduct; evaluatedAt: string; href: string }) {
  const unavailable = availabilityText(product.availability, evaluatedAt);
  return (
    <Link
      href={href}
      className={cn("grid gap-2 rounded-lg text-ink no-underline", focusRing)}
    >
      {product.primaryImageUrl ? (
        // Plain `<img>` for the same reason as ProductCard.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={product.primaryImageUrl}
          alt=""
          width={144}
          height={144}
          loading="lazy"
          decoding="async"
          className={cn("aspect-square w-full rounded-lg bg-sunken object-cover", unavailable && "opacity-55")}
        />
      ) : (
        <span aria-hidden="true" className="aspect-square w-full rounded-lg bg-sunken" />
      )}
      <span className={cn("text-body font-semibold break-words", unavailable && "text-ink-muted")}>{product.name}</span>
      <span className="text-label font-semibold tabular-nums">{`Từ ${formatVnd(product.fromPrice)}`}</span>
      {unavailable ? (
        <StatusBadge tone={badgeTone(product.availability)} className="justify-self-start">
          {unavailable}
        </StatusBadge>
      ) : null}
    </Link>
  );
}
