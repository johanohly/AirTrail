import { loader } from "fumadocs-core/source";
import { createOpenAPI, openapiPlugin } from "fumadocs-openapi/server";
import { docs } from "@/.source";

export const openapi = createOpenAPI({
  input: ["./openapi.yaml"],
});

export const source = loader({
  baseUrl: "/docs",
  source: docs.toFumadocsSource(),
  plugins: [openapiPlugin()],
});
