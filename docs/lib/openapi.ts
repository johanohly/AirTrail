import { createOpenAPI } from "fumadocs-openapi/server";

export const openapi = createOpenAPI({
  input: ["./openapi.yaml", "../src/lib/api/v1/openapi.yaml"],
});
