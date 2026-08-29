import test from "node:test";
import assert from "node:assert/strict";

import { INNERTUBE_SESSION_OPTIONS } from "../api/_youtube.js";

test("InnerTube requests use the Vietnamese catalog context", () => {
  assert.equal(INNERTUBE_SESSION_OPTIONS.lang, "vi");
  assert.equal(INNERTUBE_SESSION_OPTIONS.location, "VN");
  assert.equal(INNERTUBE_SESSION_OPTIONS.timezone, "Asia/Ho_Chi_Minh");
  assert.equal(INNERTUBE_SESSION_OPTIONS.generate_session_locally, true);
});