import { type ReactNode, createContext, use, useId } from "react";

/**
 * Stands in for @hayi/ui's Dialog in Vitest: Radix loads @hayi/ui's own React (19.3.0) through CommonJS, which is
 * not this app's (19.3.1), and its hooks then fail. Same parts and roles (a `dialog` named by its title); the real
 * dialog runs in the Playwright specs.
 */
const TitleId = createContext("");

export const PlainDialog = {
  Root: ({ open, children }: { open?: boolean; onOpenChange?: (open: boolean) => void; children: ReactNode }) => (open ? <>{children}</> : null),
  Content: ({ children }: { children: ReactNode; className?: string }) => {
    const id = useId();
    return (
      <TitleId value={id}>
        <div role="dialog" aria-labelledby={id}>
          {children}
        </div>
      </TitleId>
    );
  },
  Title: ({ children }: { children: ReactNode }) => <h2 id={use(TitleId)}>{children}</h2>,
  Description: ({ children }: { children: ReactNode; className?: string }) => <p>{children}</p>,
  Actions: ({ children }: { children: ReactNode }) => <div>{children}</div>,
};
