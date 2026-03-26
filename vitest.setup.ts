import { beforeEach } from "vitest";
import { clients } from "./app/api/oauth/clients";

process.env.JWT_SECRET = "test-secret-key-for-vitest-minimum-length";

beforeEach(() => {
  clients.clear();
});
