import { fetchAndInjectMetadata } from "./_utils/metadata-client.js";

export async function onRequest(context) {
  return fetchAndInjectMetadata(context, "stock");
}
