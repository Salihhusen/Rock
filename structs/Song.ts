import { AudioResource, createAudioResource, StreamType } from "@discordjs/voice";
import youtube from "youtube-sr";
import ytdl from "@distube/ytdl-core";
import { i18n } from "../utils/i18n";
import { videoPattern, isURL } from "../utils/patterns";

// Optional YouTube credentials, read from the environment and never hardcoded.
function getRequestOptions() {
  const headers: Record<string, string> = {};

  if (process.env.YT_COOKIE) headers.cookie = process.env.YT_COOKIE;
  if (process.env.YT_TOKEN) headers["x-youtube-identity-token"] = process.env.YT_TOKEN;

  return Object.keys(headers).length ? { headers } : {};
}

export interface SongData {
  url: string;
  title: string;
  duration: number;
}

export class Song {
  public readonly url: string;
  public readonly title: string;
  public readonly duration: number;

  public constructor({ url, title, duration }: SongData) {
    this.url = url;
    this.title = title;
    this.duration = duration;
  }

  public static async from(url: string = "", search: string = "") {
    const isYoutubeUrl = videoPattern.test(url);

    let songInfo;

    if (isYoutubeUrl) {
      songInfo = await ytdl.getInfo(url, { requestOptions: getRequestOptions() });

      return new this({
        url: songInfo.videoDetails.video_url,
        title: songInfo.videoDetails.title,
        duration: parseInt(songInfo.videoDetails.lengthSeconds)
      });
    } else {
      const result = await youtube.searchOne(search);

      result ? null : console.log(`No results found for ${search}`); // This is for handling the case where no results are found (spotify links for example)

      if (!result) {
        let err = new Error(`No search results found for ${search}`);
        err.name = "NoResults";
        if (isURL.test(url)) err.name = "InvalidURL";

        throw err;
      }
      songInfo = await ytdl.getInfo(`https://youtube.com/watch?v=${result.id}`, {
        requestOptions: getRequestOptions()
      });

      return new this({
        url: songInfo.videoDetails.video_url,
        title: songInfo.videoDetails.title,
        duration: parseInt(songInfo.videoDetails.lengthSeconds)
      });
    }
  }

  public async makeResource(): Promise<AudioResource<Song> | void> {
    let stream;

    let type = this.url.includes("youtube.com") ? StreamType.Arbitrary : StreamType.OggOpus;

    const source = this.url.includes("youtube") ? "youtube" : "soundcloud";

    if (source === "youtube") {
      stream = ytdl(this.url, {
        filter: "audioonly",
        quality: "highestaudio",
        highWaterMark: 1 << 25,
        requestOptions: getRequestOptions()
      });
    }

    if (!stream) return;

    return createAudioResource(stream, { metadata: this, inputType: type, inlineVolume: true });
  }

  public startMessage() {
    return i18n.__mf("play.startedPlaying", { title: this.title, url: this.url });
  }
}
