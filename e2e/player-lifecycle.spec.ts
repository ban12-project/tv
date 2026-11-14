import { expect, test } from "@playwright/test";
import {
  parseAdSkipRangesFromPlaylistText,
  parseAdSkipRangesFromPlaylistTextWithSideChannel,
} from "../lib/player/ad-tag-parser";
import {
  buildTimelineSampleIndex,
  type FragmentTimelineSample,
  mapSkipRangesToMediaTime,
  upsertFragmentTimelineSample,
} from "../lib/player/timeline-mapper";

interface PlayerProbe {
  loads: number;
  time: number;
  wireless: boolean;
  remoteState: "disconnected" | "connecting" | "connected";
  visibility: DocumentVisibilityState;
  width: number;
  height: number;
  paused: boolean;
  wakeLocks: number;
  releasedWakeLocks: number;
}

declare global {
  interface Window {
    playerProbe: PlayerProbe;
  }
}

// Simulate Safari's native media/remote APIs, without claiming to exercise
// a physical AirPlay receiver. The real React player and preferences run.
test.describe("native HLS playback lifecycle", () => {
  test.skip(
    process.env.ACCESS_MODE !== "public",
    "fixture playback requires public access",
  );

  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem("auto-skip", "true");
      const probe: PlayerProbe = {
        loads: 0,
        time: 0,
        wireless: false,
        remoteState: "disconnected",
        visibility: "visible",
        width: 1920,
        height: 1080,
        paused: true,
        wakeLocks: 0,
        releasedWakeLocks: 0,
      };
      window.playerProbe = probe;
      const remote = new EventTarget();
      Object.defineProperty(remote, "state", {
        get: () => probe.remoteState,
      });
      Object.defineProperty(document, "visibilityState", {
        get: () => probe.visibility,
      });
      Object.defineProperties(HTMLMediaElement.prototype, {
        canPlayType: {
          value: (type: string) => (type.includes("mpegurl") ? "probably" : ""),
        },
        remote: { get: () => remote },
        currentTime: {
          get: () => probe.time,
          set: (time: number) => {
            probe.time = time;
          },
        },
        duration: { get: () => 120 },
        readyState: { get: () => 4 },
        paused: { get: () => probe.paused },
        load: {
          value: function (this: HTMLMediaElement) {
            probe.loads += 1;
            if (this.getAttribute("src")) {
              queueMicrotask(() =>
                this.dispatchEvent(new Event("loadedmetadata")),
              );
            }
          },
        },
        play: {
          value: function (this: HTMLMediaElement) {
            probe.paused = false;
            this.dispatchEvent(new Event("play"));
            this.dispatchEvent(new Event("playing"));
            return Promise.resolve();
          },
        },
      });
      Object.defineProperties(HTMLVideoElement.prototype, {
        videoWidth: { get: () => probe.width },
        videoHeight: { get: () => probe.height },
        webkitCurrentPlaybackTargetIsWireless: {
          get: () => probe.wireless,
        },
        requestVideoFrameCallback: { value: () => 1 },
        cancelVideoFrameCallback: { value: () => {} },
      });
      Object.defineProperty(navigator, "wakeLock", {
        value: {
          request: async () => {
            probe.wakeLocks += 1;
            const sentinel = new EventTarget();
            return Object.assign(sentinel, {
              release: async () => {
                probe.releasedWakeLocks += 1;
                sentinel.dispatchEvent(new Event("release"));
              },
            });
          },
        },
      });
    });
    await page.route("**/media/*.m3u8", (route) =>
      route.fulfill({
        contentType: "application/vnd.apple.mpegurl",
        headers: { "access-control-allow-origin": "*" },
        body: [
          "#EXTM3U",
          "#EXT-X-TARGETDURATION:10",
          "#EXTINF:10,",
          "first.ts",
          "#EXTINF:10,",
          "second.ts",
          "#EXT-X-CUE-OUT:10",
          "#EXTINF:10,",
          "ad.ts",
          "#EXT-X-CUE-IN",
          "#EXTINF:10,",
          "last.ts",
          "#EXT-X-ENDLIST",
        ].join("\n"),
      }),
    );
    await page.route("**/media/*.ts", (route) =>
      route.fulfill({
        contentType: "video/mp2t",
        headers: { "access-control-allow-origin": "*" },
        body: "",
      }),
    );
    await page.goto("/en/watch/fixture/1001/1");
    await expect(page.locator("#auto-skip")).toBeChecked();
    await expect(page.locator("video")).toHaveAttribute(
      "src",
      /bullet-train\.m3u8$/,
    );
    // Verify that a real parsed ad range works locally before checking that
    // remote playback suppresses it.
    await page.evaluate(() => {
      window.playerProbe.time = 25;
      document.querySelector("video")?.dispatchEvent(new Event("timeupdate"));
    });
    await expect
      .poll(() => page.evaluate(() => window.playerProbe.time))
      .toBe(30);
  });

  test("preferences and metadata preserve the native source and position", async ({
    page,
  }) => {
    const loads = await page.evaluate(() => window.playerProbe.loads);
    await page.locator("#auto-skip").click();
    await expect(page.locator("#auto-skip")).not.toBeChecked();
    await page.locator("#auto-skip").click();
    await expect(page.locator("#auto-skip")).toBeChecked();

    await page.evaluate(() => {
      window.playerProbe.width = 1080;
      window.playerProbe.height = 1920;
      document
        .querySelector("video")
        ?.dispatchEvent(new Event("loadedmetadata"));
    });
    await expect(
      page.getByText("Short-burst mode", { exact: true }),
    ).toBeVisible();
    await expect
      .poll(() => page.evaluate(() => window.playerProbe.loads))
      .toBe(loads);
    expect(await page.evaluate(() => window.playerProbe.time)).toBe(30);
    await expect(page.locator("video")).toHaveAttribute(
      "x-webkit-airplay",
      "allow",
    );
    await expect(page.locator("video")).toHaveAttribute("src", /\.m3u8$/);
  });

  for (const target of ["webkit", "remote-api"] as const) {
    test(`${target} transitions suspend auto-seek and release the screen lock`, async ({
      page,
    }) => {
      const loads = await page.evaluate(() => window.playerProbe.loads);
      await expect
        .poll(() => page.evaluate(() => window.playerProbe.wakeLocks))
        .toBe(1);
      await page.evaluate((kind) => {
        const video = document.querySelector("video");
        if (!video) throw new Error("Missing player");
        window.playerProbe.time = 25;
        if (kind === "webkit") {
          window.playerProbe.wireless = true;
          video.dispatchEvent(
            new Event("webkitcurrentplaybacktargetiswirelesschanged"),
          );
        } else {
          window.playerProbe.remoteState = "connecting";
          video.remote.dispatchEvent(new Event("connecting"));
          window.playerProbe.remoteState = "connected";
          video.remote.dispatchEvent(new Event("connect"));
        }
        window.playerProbe.visibility = "hidden";
        document.dispatchEvent(new Event("visibilitychange"));
        video.dispatchEvent(new Event("timeupdate"));
      }, target);
      await page.locator("#auto-skip").click();
      await page.locator("#auto-skip").click();
      await expect(page.locator("#auto-skip")).toBeChecked();
      await expect
        .poll(() => page.evaluate(() => window.playerProbe.releasedWakeLocks))
        .toBe(1);
      expect(await page.evaluate(() => window.playerProbe.time)).toBe(25);
      expect(await page.evaluate(() => window.playerProbe.loads)).toBe(loads);

      await page.evaluate(() => {
        const video = document.querySelector("video");
        if (!video) throw new Error("Missing player");
        window.playerProbe.wireless = false;
        window.playerProbe.remoteState = "disconnected";
        window.playerProbe.visibility = "visible";
        video.dispatchEvent(
          new Event("webkitcurrentplaybacktargetiswirelesschanged"),
        );
        video.remote.dispatchEvent(new Event("disconnect"));
        document.dispatchEvent(new Event("visibilitychange"));
        video.dispatchEvent(new Event("timeupdate"));
      });
      await expect
        .poll(() => page.evaluate(() => window.playerProbe.time))
        .toBe(30);
      expect(await page.evaluate(() => window.playerProbe.loads)).toBe(loads);
      await expect(page.locator("video")).toHaveAttribute("src", /\.m3u8$/);
    });
  }
});

function createTsPacket(pid: number, payload: number[], pusi = true): number[] {
  const packet = new Array<number>(188).fill(0xff);
  packet[0] = 0x47;
  packet[1] = (pusi ? 0x40 : 0x00) | ((pid >> 8) & 0x1f);
  packet[2] = pid & 0xff;
  packet[3] = 0x10;
  for (let index = 0; index < payload.length && index + 4 < 188; index++) {
    packet[4 + index] = payload[index];
  }
  return packet;
}

function buildSyntheticTsSegment(options: {
  spsBytes: number[];
  ppsBytes: number[];
}): Uint8Array {
  // PAT (PID 0x0000 -> Program 1 -> PMT PID 0x1000)
  const patSection = [
    0x00, 0x00, 0xb0, 0x0d, 0x00, 0x01, 0xc1, 0x00, 0x00, 0x00, 0x01, 0xf0,
    0x00, 0x00, 0x00, 0x00, 0x00,
  ];
  // PMT (PID 0x1000 -> Video H.264 PID 0x0100, Audio AAC PID 0x0101)
  const pmtSection = [
    0x00, 0x02, 0xb0, 0x17, 0x00, 0x01, 0xc1, 0x00, 0x00, 0xe1, 0x00, 0xf0,
    0x00, 0x1b, 0xe1, 0x00, 0xf0, 0x00, 0x0f, 0xe1, 0x01, 0xf0, 0x00, 0x00,
    0x00, 0x00, 0x00,
  ];
  // PES + Annex B SPS (NAL 7) + PPS (NAL 8)
  const pesHeader = [0x00, 0x00, 0x01, 0xe0, 0x00, 0x00, 0x80, 0x00, 0x00];
  const videoPayload = [
    ...pesHeader,
    0x00,
    0x00,
    0x00,
    0x01,
    ...options.spsBytes,
    0x00,
    0x00,
    0x00,
    0x01,
    ...options.ppsBytes,
  ];
  // PES + ADTS AAC header (48kHz stereo LC)
  const audioPayload = [
    0x00, 0x00, 0x01, 0xc0, 0x00, 0x00, 0x80, 0x00, 0x00, 0xff, 0xf1, 0x50,
    0x80, 0x01, 0xff, 0xfc,
  ];

  const bytes = [
    ...createTsPacket(0x0000, patSection, true),
    ...createTsPacket(0x1000, pmtSection, true),
    ...createTsPacket(0x0100, videoPayload, true),
    ...createTsPacket(0x0101, audioPayload, true),
  ];
  return new Uint8Array(bytes);
}

test.describe("ad skip accuracy and timeline calibration", () => {
  test("avoids partial skips on explicit #EXT-X-CUE-IN and avoids overshooting on unclosed VOD #EXT-X-CUE-OUT", () => {
    const cueInPlaylist = [
      "#EXTM3U",
      "#EXTINF:10,",
      "main-0.ts",
      "#EXT-X-CUE-OUT:10",
      "#EXTINF:5.3,",
      "ad-0.ts",
      "#EXTINF:5.3,",
      "ad-1.ts",
      "#EXT-X-CUE-IN",
      "#EXTINF:10,",
      "main-1.ts",
      "#EXT-X-ENDLIST",
    ].join("\n");

    const cueInRanges = parseAdSkipRangesFromPlaylistText(cueInPlaylist);
    expect(cueInRanges).toHaveLength(1);
    expect(cueInRanges[0].start).toBeCloseTo(10, 3);
    expect(cueInRanges[0].end).toBeCloseTo(20.6, 3);

    const unclosedVodPlaylist = [
      "#EXTM3U",
      "#EXTINF:20,",
      "main-0.ts",
      "#EXT-X-DISCONTINUITY",
      "#EXT-X-CUE-OUT",
      "#EXTINF:6,",
      "ad-0.ts",
      "#EXTINF:6,",
      "ad-1.ts",
      "#EXT-X-DISCONTINUITY",
      "#EXTINF:100,",
      "main-1.ts",
      "#EXTINF:100,",
      "main-2.ts",
      "#EXT-X-ENDLIST",
    ].join("\n");

    const unclosedVodRanges =
      parseAdSkipRangesFromPlaylistText(unclosedVodPlaylist);
    expect(unclosedVodRanges).toEqual([{ start: 20, end: 32 }]);
  });

  test("detects structural foreign-directory and repeated ad blocks while preventing baseline poisoning and PPS-only false positives", async () => {
    // High-profile 1080p-like SPS vs Baseline 720p-like SPS
    const mainSps = [
      0x67, 0x64, 0x00, 0x28, 0xac, 0xd9, 0x40, 0x78, 0x02, 0x27, 0xe5, 0xc0,
      0x44, 0x00, 0x00, 0x03, 0x00, 0x04, 0x00, 0x00, 0x03, 0x00, 0xf0, 0x3c,
      0x60, 0xc6, 0x58,
    ];
    const adSps = [
      0x67, 0x42, 0xc0, 0x1f, 0xda, 0x01, 0x40, 0x16, 0xec, 0x04, 0x40, 0x00,
      0x00, 0x03, 0x00, 0x40, 0x00, 0x00, 0x0f, 0x03, 0xc6, 0x0c, 0x65, 0x80,
    ];

    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (input: RequestInfo | URL) => {
      const url = String(input);
      const isAd = url.includes("/20260423/ad/") || url.includes("same-dir-ad");
      const chunkVariant = url.includes("main-b") ? 0x22 : 0x11;
      const segmentBytes = buildSyntheticTsSegment({
        spsBytes: isAd ? adSps : mainSps,
        // Main content varies PPS bytes across discontinuity chunks while keeping SPS identical
        ppsBytes: isAd
          ? [0x68, 0xce, 0x3c, 0x80]
          : [0x68, 0xeb, 0xe3, chunkVariant],
      });
      return new Response(Buffer.from(segmentBytes), {
        status: 206,
        headers: {
          "Content-Range": `bytes 0-${segmentBytes.byteLength - 1}/${
            isAd ? 900_000 : 300_000
          }`,
        },
      });
    };

    try {
      const playlist = [
        "#EXTM3U",
        "#EXTINF:10,",
        "https://cdn.example.com/20250723/main/hls/main-a-0.ts",
        "#EXTINF:10,",
        "https://cdn.example.com/20250723/main/hls/main-a-1.ts",
        "#EXT-X-DISCONTINUITY",
        "#EXTINF:10,",
        "https://cdn.example.com/20250723/main/hls/main-a-2.ts",
        "#EXTINF:10,",
        "https://cdn.example.com/20250723/main/hls/main-a-3.ts",
        "#EXT-X-DISCONTINUITY",
        // 10-segment foreign-directory ad block ending with a 0.76s tail segment (20.235s total)
        "#EXTINF:2.0,",
        "https://cdn.example.com/20260423/ad/hls/ad-0.ts",
        "#EXTINF:2.0,",
        "https://cdn.example.com/20260423/ad/hls/ad-1.ts",
        "#EXTINF:2.0,",
        "https://cdn.example.com/20260423/ad/hls/ad-2.ts",
        "#EXTINF:2.0,",
        "https://cdn.example.com/20260423/ad/hls/ad-3.ts",
        "#EXTINF:2.0,",
        "https://cdn.example.com/20260423/ad/hls/ad-4.ts",
        "#EXTINF:2.0,",
        "https://cdn.example.com/20260423/ad/hls/ad-5.ts",
        "#EXTINF:2.0,",
        "https://cdn.example.com/20260423/ad/hls/ad-6.ts",
        "#EXTINF:2.0,",
        "https://cdn.example.com/20260423/ad/hls/ad-7.ts",
        "#EXTINF:3.475,",
        "https://cdn.example.com/20260423/ad/hls/ad-8.ts",
        "#EXTINF:0.76,",
        "https://cdn.example.com/20260423/ad/hls/ad-9.ts",
        "#EXT-X-DISCONTINUITY",
        // Subsequent main-content discontinuity blocks with different PPS hash
        "#EXTINF:10,",
        "https://cdn.example.com/20250723/main/hls/main-b-0.ts",
        "#EXTINF:10,",
        "https://cdn.example.com/20250723/main/hls/main-b-1.ts",
        "#EXT-X-DISCONTINUITY",
        "#EXTINF:10,",
        "https://cdn.example.com/20250723/main/hls/main-b-2.ts",
        "#EXTINF:10,",
        "https://cdn.example.com/20250723/main/hls/main-b-3.ts",
        "#EXT-X-DISCONTINUITY",
        "#EXTINF:10,",
        "https://cdn.example.com/20250723/main/hls/main-a-4.ts",
        "#EXTINF:10,",
        "https://cdn.example.com/20250723/main/hls/main-a-5.ts",
        "#EXT-X-ENDLIST",
      ].join("\n");

      // Even when playbackTime is 60.235 (right after the 10-segment ad block),
      // the baseline is not poisoned and main-b blocks are not falsely skipped.
      const ranges = await parseAdSkipRangesFromPlaylistTextWithSideChannel(
        playlist,
        {
          playlistUrl: "https://cdn.example.com/20250723/main/hls/index.m3u8",
          playbackTime: 60.235,
          enableMediaFingerprintProbe: true,
        },
      );

      expect(ranges).toHaveLength(1);
      expect(ranges[0].start).toBeCloseTo(40, 3);
      expect(ranges[0].end).toBeCloseTo(60.235, 3);

      // Also verify same-directory ad at playbackTime = 0 with 15 segments (>12) and a 0.8s tail segment
      const sameDirAdSegments: string[] = [];
      for (let index = 0; index < 14; index++) {
        sameDirAdSegments.push("#EXTINF:2.0,");
        sameDirAdSegments.push(
          `https://cdn.example.com/20250723/main/hls/same-dir-ad-${index}.ts`,
        );
      }
      sameDirAdSegments.push("#EXTINF:0.8,");
      sameDirAdSegments.push(
        "https://cdn.example.com/20250723/main/hls/same-dir-ad-14.ts",
      );

      const sameDirPlaylist = [
        "#EXTM3U",
        "#EXTINF:10,",
        "https://cdn.example.com/20250723/main/hls/main-a-0.ts",
        "#EXT-X-DISCONTINUITY",
        ...sameDirAdSegments,
        "#EXT-X-DISCONTINUITY",
        "#EXTINF:25,",
        "https://cdn.example.com/20250723/main/hls/main-a-1.ts",
        "#EXTINF:25,",
        "https://cdn.example.com/20250723/main/hls/main-a-2.ts",
        "#EXTINF:25,",
        "https://cdn.example.com/20250723/main/hls/main-a-3.ts",
        "#EXT-X-ENDLIST",
      ].join("\n");

      const startupRanges =
        await parseAdSkipRangesFromPlaylistTextWithSideChannel(
          sameDirPlaylist,
          {
            playlistUrl: "https://cdn.example.com/20250723/main/hls/index.m3u8",
            playbackTime: 0,
            enableMediaFingerprintProbe: true,
          },
        );
      expect(startupRanges).toHaveLength(1);
      expect(startupRanges[0].start).toBeCloseTo(10, 3);
      expect(startupRanges[0].end).toBeCloseTo(38.8, 3);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test("calibrates partial timeline drift and converges fragment boundaries without losing raw playlist bounds", () => {
    const samples = new Map<string, FragmentTimelineSample>();

    // Initial playlist load before PTS demuxing
    upsertFragmentTimelineSample(samples, {
      key: "level=0:cc=1:sn=10:url=seg10.ts",
      cc: 1,
      playlistStart: 1680,
      playlistEnd: 1688,
    });
    upsertFragmentTimelineSample(samples, {
      key: "level=0:cc=2:sn=11:url=ad1.ts",
      cc: 2,
      playlistStart: 1688,
      playlistEnd: 1693,
    });

    // Media demuxing reveals +2.95s cumulative PTS drift at ad start
    upsertFragmentTimelineSample(samples, {
      key: "level=0:cc=1:sn=10:url=seg10.ts",
      cc: 1,
      playlistStart: 1680,
      playlistEnd: 1688,
      mediaStart: 1682.95,
      mediaEnd: 1690.98,
    });
    upsertFragmentTimelineSample(samples, {
      key: "level=0:cc=2:sn=11:url=ad1.ts",
      cc: 2,
      playlistStart: 1688,
      playlistEnd: 1693,
      mediaStart: 1690.95,
      mediaEnd: 1695.95,
    });

    // Subsequent playlist refresh after hls.js mutated frag.start in-place must not overwrite playlistStart
    upsertFragmentTimelineSample(samples, {
      key: "level=0:cc=2:sn=11:url=ad1.ts",
      cc: 2,
      playlistStart: 1690.95,
      playlistEnd: 1695.95,
    });

    const index = buildTimelineSampleIndex(samples);
    // End of ad (1713s) is not buffered yet, but start (1688s) and first ad segment (1693s) are calibrated
    const partiallyCalibrated = mapSkipRangesToMediaTime(index, [
      { start: 1688, end: 1713 },
    ]);
    expect(partiallyCalibrated).toHaveLength(1);
    expect(partiallyCalibrated[0].calibrated).toBe(true);
    expect(partiallyCalibrated[0].start).toBeCloseTo(1690.95, 2);
    expect(partiallyCalibrated[0].end).toBeCloseTo(1715.95, 2);

    // Once the ad tail and post-ad main fragment are buffered, end converges to max(adEnd, postAdStart)
    upsertFragmentTimelineSample(samples, {
      key: "level=0:cc=2:sn=15:url=ad5.ts",
      cc: 2,
      playlistStart: 1708,
      playlistEnd: 1713,
      mediaStart: 1710.95,
      mediaEnd: 1716.02,
    });
    upsertFragmentTimelineSample(samples, {
      key: "level=0:cc=3:sn=16:url=seg16.ts",
      cc: 3,
      playlistStart: 1713,
      playlistEnd: 1720,
      mediaStart: 1715.96,
      mediaEnd: 1722.96,
    });

    const fullyCalibrated = mapSkipRangesToMediaTime(
      buildTimelineSampleIndex(samples),
      [{ start: 1688, end: 1713 }],
    );
    expect(fullyCalibrated[0].calibrated).toBe(true);
    expect(fullyCalibrated[0].end).toBeCloseTo(1716.02, 2);
  });
});
