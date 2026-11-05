import "@testing-library/jest-dom/vitest";
import { cleanup, configure } from "@testing-library/react";
import { afterEach } from "vitest";

// The first render of a file mounts the whole route tree; on a busy CI runner that alone took 1.3 s, past the
// default 1 s of findBy*/waitFor (branch-hours, PR #55). 3 s keeps real failures fast enough.
configure({ asyncUtilTimeout: 3000 });

// jsdom lacks pointer capture, which Radix uses for swipe/pointer handling.
if (!Element.prototype.hasPointerCapture) {
  Element.prototype.hasPointerCapture = () => false;
  Element.prototype.setPointerCapture = () => {};
  Element.prototype.releasePointerCapture = () => {};
}

// jsdom lacks scrolling; the router restores scroll positions.
window.scrollTo = () => {};

afterEach(cleanup);
