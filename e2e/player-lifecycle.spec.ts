import { expect, test } from "@playwright/test";

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
