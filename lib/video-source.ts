export type VideoSourceConfig = {
  name: string;
  baseUrl: string;
  detailPath?: string;
};

export class VideoSource {
  id: string;
  name: string;
  baseUrl: string;
  detailPath?: string;
  disabled: boolean = false;

  constructor({ name, baseUrl, detailPath }: VideoSourceConfig) {
    this.id = crypto.randomUUID();
    this.name = name;
    this.baseUrl = baseUrl;
    this.detailPath = detailPath;
  }

  async search(query: string, page = 1) {
    const url = new URL(this.baseUrl);
    url.searchParams.append("query", query);
    url.searchParams.append("page", page.toString());

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error("Network response was not ok");
    }
    const data = await response.json();
    return data;
  }

  async getDetail(id: string) {
    const url = new URL(this.baseUrl);
    url.searchParams.append("id", id);

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error("Network response was not ok");
    }
    const data = await response.json();
    return data;
  }

  static createVideoSources(configs: VideoSourceConfig[]) {
    return configs.map((config) => new VideoSource(config));
  }
}
