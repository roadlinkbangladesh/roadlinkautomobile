import { fetchAndInjectMetadata } from "../_utils/metadata-client.js";

export async function onRequest(context) {
  const stock = context.params.stock;
  return fetchAndInjectMetadata(context, "vehicle", stock);
}
