import { createServer } from "node:http";

const port = Number.parseInt(process.env.E2E_FIXTURE_PORT ?? "4101", 10);

const videos = [
  {
    vod_id: 1001,
    vod_name: "Bullet Train",
    type_name: "电影",
    vod_pic: `http://127.0.0.1:${port}/poster.svg`,
    vod_remarks: "Fixture",
    vod_year: "2022",
    vod_area: "US",
    vod_director: "David Leitch",
    vod_actor: "Brad Pitt,Joey King",
    vod_content: "Five assassins board the same train.",
    vod_play_from: "fixture",
    vod_play_url: `Main$//127.0.0.1:${port}/media/bullet-train.m3u8`,
    vod_time: "2026-01-01 00:00:00",
  },
  {
    vod_id: 1002,
    vod_name: "ECheng Dispatch",
    type_name: "电视剧",
    vod_pic: `http://127.0.0.1:${port}/poster.svg`,
    vod_remarks: "2 episodes",
    vod_year: "2026",
    vod_area: "CN",
    vod_director: "Fixture Bureau",
    vod_actor: "Agent One,Agent Two",
    vod_content: "A fixture series for route coverage.",
    vod_play_from: "fixture",
    vod_play_url: `Episode 1$//127.0.0.1:${port}/media/dispatch-1.m3u8#Episode 2$//127.0.0.1:${port}/media/dispatch-2.m3u8`,
    vod_time: "2026-01-01 00:00:00",
  },
];

function json(response, data) {
  response.writeHead(200, {
    "access-control-allow-origin": "*",
    "content-type": "application/json; charset=utf-8",
  });
  response.end(JSON.stringify(data));
}

const server = createServer((request, response) => {
  const url = new URL(request.url ?? "/", `http://127.0.0.1:${port}`);

  if (url.pathname === "/") {
    response.writeHead(200, { "content-type": "text/plain; charset=utf-8" });
    response.end("ok");
    return;
  }

  if (url.pathname === "/poster.svg") {
    response.writeHead(200, {
      "access-control-allow-origin": "*",
      "content-type": "image/svg+xml",
    });
    response.end(
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 360"><rect width="240" height="360" fill="#111"/><text x="120" y="180" fill="#fff" font-size="28" text-anchor="middle">E2E</text></svg>',
    );
    return;
  }

  if (url.pathname.startsWith("/media/")) {
    response.writeHead(200, {
      "access-control-allow-origin": "*",
      "content-type": "application/vnd.apple.mpegurl",
    });
    response.end("#EXTM3U\n#EXT-X-VERSION:3\n#EXT-X-ENDLIST\n");
    return;
  }

  if (url.pathname !== "/api.php/provide/vod/") {
    response.writeHead(404);
    response.end("Not Found");
    return;
  }

  const ids = url.searchParams.get("ids");
  const query = url.searchParams.get("wd")?.toLowerCase().trim();
  const list = videos.filter((video) => {
    if (ids) return String(video.vod_id) === ids;
    if (query) return video.vod_name.toLowerCase().includes(query);
    return true;
  });

  json(response, {
    code: 1,
    msg: "ok",
    page: 1,
    pagecount: 1,
    limit: 20,
    total: list.length,
    list,
  });
});

server.listen(port, "127.0.0.1", () => {
  console.log(`MAC CMS fixture listening on http://127.0.0.1:${port}`);
});
