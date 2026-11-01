/**
 * The accounts RPCs raise as `<rpc_name>: <reason>` (e.g.
 * "update_staff_account: you cannot change your own role"). The prefix is for
 * the logs, not for a Super Staff reading a toast: drop it and capitalize what
 * is left. Only the leading identifier goes — a later colon in the reason
 * stays. A message with no such prefix is returned as is.
 */
export function plainRpcError(message: string): string {
  const prefix = /^[a-z_][a-z0-9_]*: /.exec(message);
  if (!prefix) return message;
  const rest = message.slice(prefix[0].length);
  return rest.charAt(0).toUpperCase() + rest.slice(1);
}
