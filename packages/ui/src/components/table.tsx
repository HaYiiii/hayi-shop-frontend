import type { ComponentProps } from "react";
import { cn } from "../cn.js";

/** Backoffice data table, compact density. Wide tables scroll inside the wrapper, never the page. */
function TableRoot({ className, ...props }: ComponentProps<"table">) {
  return (
    <div className="overflow-x-auto rounded-lg border border-line bg-paper">
      <table className={cn("w-full border-collapse text-body tabular-nums", className)} {...props} />
    </div>
  );
}

function Head(props: ComponentProps<"thead">) {
  return <thead {...props} />;
}

function Body(props: ComponentProps<"tbody">) {
  return <tbody {...props} />;
}

function Row({ selected, className, ...props }: ComponentProps<"tr"> & { selected?: boolean }) {
  return (
    <tr
      aria-selected={selected || undefined}
      className={cn(
        "border-b border-line last:border-b-0 [tbody_&]:hover:bg-sunken aria-selected:bg-matcha-50",
        className,
      )}
      {...props}
    />
  );
}

type CellProps = { numeric?: boolean };

/** Column header; a column holding only buttons gets a `sr-only` title. */
function HeaderCell({ numeric, className, ...props }: ComponentProps<"th"> & CellProps) {
  return (
    <th
      scope="col"
      className={cn(
        "whitespace-nowrap bg-cream px-3 py-2 text-left text-label text-ink-muted",
        numeric && "text-right",
        className,
      )}
      {...props}
    />
  );
}

/** `numeric` right-aligns money and counts. */
function Cell({ numeric, className, ...props }: ComponentProps<"td"> & CellProps) {
  return (
    <td
      className={cn("h-row-compact px-3 py-2 align-middle", numeric && "text-right", className)}
      {...props}
    />
  );
}

export const Table = { Root: TableRoot, Head, Body, Row, HeaderCell, Cell };
