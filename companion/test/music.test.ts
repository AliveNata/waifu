import { describe, expect, it } from "vitest";
import { isYoutubeLink } from "../src/main/youtube-embeds.js";
import {
  addSong,
  defaultSongs,
  embedUrl,
  initialMusic,
  nextSong,
  oembedUrl,
  parseMusicState,
  parseTitles,
  removeSong,
  titleFrom,
  volumeCommand,
  youtubeIdFrom,
} from "../src/renderer/office/music.js";

describe("youtubeIdFrom", () => {
  it.each([
    ["https://www.youtube.com/watch?v=6NKt7Y7yOyw", "6NKt7Y7yOyw"],
    ["https://www.youtube.com/watch?v=bhLfxROL-k4&list=RD123&t=30", "bhLfxROL-k4"],
    ["youtube.com/watch?v=6NKt7Y7yOyw", "6NKt7Y7yOyw"],
    ["https://youtu.be/6NKt7Y7yOyw?si=abc", "6NKt7Y7yOyw"],
    ["https://m.youtube.com/watch?v=6NKt7Y7yOyw", "6NKt7Y7yOyw"],
    ["https://music.youtube.com/watch?v=6NKt7Y7yOyw", "6NKt7Y7yOyw"],
    ["https://www.youtube.com/shorts/6NKt7Y7yOyw", "6NKt7Y7yOyw"],
    ["https://www.youtube.com/live/6NKt7Y7yOyw", "6NKt7Y7yOyw"],
    ["  6NKt7Y7yOyw  ", "6NKt7Y7yOyw"],
  ])("reads the video id from %s", (link, id) => {
    expect(youtubeIdFrom(link)).toBe(id);
  });

  it.each([
    "https://vimeo.com/123456",
    "https://www.youtube.com/channel/UC123",
    "https://www.youtube.com/watch?v=short",
    "https://evil.example/watch?v=6NKt7Y7yOyw",
    "bukan link",
    "",
  ])("rejects %s", (link) => {
    expect(youtubeIdFrom(link)).toBeNull();
  });
});

describe("embedUrl", () => {
  it("plays the song straight away and loops that same song", () => {
    // Act
    const url = new URL(embedUrl("6NKt7Y7yOyw", null));

    // Assert
    expect(url.origin).toBe("https://www.youtube-nocookie.com");
    expect(url.pathname).toBe("/embed/6NKt7Y7yOyw");
    expect(url.searchParams.get("autoplay")).toBe("1");
    expect(url.searchParams.get("loop")).toBe("1");
    expect(url.searchParams.get("playlist")).toBe("6NKt7Y7yOyw");
    expect(url.searchParams.has("origin")).toBe(false);
  });
});

describe("the song list", () => {
  it("starts with the two default songs, switched off", () => {
    expect(initialMusic).toEqual({ songs: [...defaultSongs], current: 0, on: false, volume: 60 });
  });

  it("adds a new link once and explains a bad or repeated one", () => {
    // Act
    const added = addSong(initialMusic, "https://youtu.be/dQw4w9WgXcQ");
    const repeated = addSong(initialMusic, "https://www.youtube.com/watch?v=6NKt7Y7yOyw");
    const bad = addSong(initialMusic, "https://vimeo.com/1");

    // Assert
    expect(added.added && added.state.songs).toEqual([...defaultSongs, "dQw4w9WgXcQ"]);
    expect(repeated).toMatchObject({ added: false, reason: "Lagu ini udah ada di daftar." });
    expect(bad).toMatchObject({ added: false, reason: "Itu bukan link video YouTube." });
  });

  it("goes round to the first song after the last", () => {
    // Act
    const second = nextSong(initialMusic);
    const backToFirst = nextSong(second);

    // Assert
    expect(second.current).toBe(1);
    expect(backToFirst.current).toBe(0);
  });

  it("keeps playing the same song when an earlier one is removed, and stops with none left", () => {
    // Arrange
    const state = { songs: ["aaaaaaaaaaa", "bbbbbbbbbbb", "ccccccccccc"], current: 2, on: true, volume: 30 };

    // Act
    const removedEarlier = removeSong(state, 0);
    const emptied = removeSong(removeSong(removeSong(state, 0), 0), 0);

    // Assert
    expect(removedEarlier.songs[removedEarlier.current]).toBe("ccccccccccc");
    expect(emptied).toEqual({ songs: [], current: 0, on: false, volume: 30 });
  });
});

describe("parseMusicState", () => {
  it("falls back to the defaults for nothing saved or a broken entry", () => {
    expect(parseMusicState(null)).toEqual(initialMusic);
    expect(parseMusicState("{not json")).toEqual(initialMusic);
  });

  it("keeps saved songs and drops anything that is not a video id", () => {
    // Act
    const state = parseMusicState(JSON.stringify({ songs: ["6NKt7Y7yOyw", "<script>", 42], current: 7, on: true }));

    // Assert
    expect(state).toEqual({ songs: ["6NKt7Y7yOyw"], current: 0, on: true, volume: 60 });
  });

  it("keeps a saved volume, within 0 to 100", () => {
    // Act
    const quiet = parseMusicState(JSON.stringify({ songs: [], volume: 25 }));
    const tooLoud = parseMusicState(JSON.stringify({ songs: [], volume: 400 }));
    const broken = parseMusicState(JSON.stringify({ songs: [], volume: "loud" }));

    // Assert
    expect(quiet.volume).toBe(25);
    expect(tooLoud.volume).toBe(100);
    expect(broken.volume).toBe(60);
  });
});

describe("volumeCommand", () => {
  it("tells the embedded player to set a whole-number volume", () => {
    // Act
    const command = JSON.parse(volumeCommand(42.6));

    // Assert
    expect(command).toEqual({ event: "command", func: "setVolume", args: [43] });
  });
});

describe("isYoutubeLink", () => {
  it("opens YouTube links from the player in the browser and nothing else", () => {
    expect(isYoutubeLink("https://www.youtube.com/watch?v=6NKt7Y7yOyw")).toBe(true);
    expect(isYoutubeLink("https://youtu.be/6NKt7Y7yOyw")).toBe(true);
    expect(isYoutubeLink("http://www.youtube.com/")).toBe(false);
    expect(isYoutubeLink("https://evil.example/")).toBe(false);
    expect(isYoutubeLink("file:///etc/passwd")).toBe(false);
  });
});

describe("song titles", () => {
  it("asks YouTube's oEmbed for the video's title", () => {
    // Act
    const url = new URL(oembedUrl("6NKt7Y7yOyw"));

    // Assert
    expect(url.origin).toBe("https://www.youtube.com");
    expect(url.pathname).toBe("/oembed");
    expect(url.searchParams.get("url")).toBe("https://www.youtube.com/watch?v=6NKt7Y7yOyw");
  });

  it("reads the title and ignores answers without one", () => {
    expect(titleFrom({ title: "  Lagu santai  ", author_name: "x" })).toBe("Lagu santai");
    expect(titleFrom({ title: "" })).toBeNull();
    expect(titleFrom(null)).toBeNull();
  });

  it("keeps only saved titles for real video ids", () => {
    // Act
    const titles = parseTitles(JSON.stringify({ "6NKt7Y7yOyw": "Satu", nope: "Dua", bhLfxROL_k4: 3 }));

    // Assert
    expect(titles).toEqual({ "6NKt7Y7yOyw": "Satu" });
    expect(parseTitles("{broken")).toEqual({});
  });
});
