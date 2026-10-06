/** Static hosting serves the client; a separately configured server owns rooms. */
export function resolveGameConnection(
  server: string,
  staticHost: boolean,
  pageUrl: string,
): { url: string | null; reason: string | null } {
  if (staticHost && !server.trim())
    return {
      url: null,
      reason:
        "Можно пройти лес одному — нажмите «Начать прогулку». Для игры с другом сервер ещё не подключён.",
    };
  try {
    const page = new URL(pageUrl);
    const endpoint = new URL("/socket", server.trim() || page.origin);
    if (!["http:", "https:", "ws:", "wss:"].includes(endpoint.protocol))
      throw new Error();
    endpoint.protocol = ["https:", "wss:"].includes(endpoint.protocol)
      ? "wss:"
      : "ws:";
    if (page.protocol === "https:" && endpoint.protocol !== "wss:")
      return {
        url: null,
        reason:
          "Для этой страницы нужен игровой сервер с защищённым подключением HTTPS/WSS.",
      };
    return { url: endpoint.href, reason: null };
  } catch {
    return {
      url: null,
      reason:
        "Адрес игрового сервера указан неверно. Совместные прогулки временно недоступны.",
    };
  }
}
