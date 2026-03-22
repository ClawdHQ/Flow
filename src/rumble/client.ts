import { config } from '../config/index.js';

export interface RumbleCreatorMetadata {
  id: string;
  handle: string;
  display_name?: string;
}

export interface RumbleVideoMetadata {
  id: string;
  title: string;
  creator_id?: string;
}

export function deriveRumbleCreatorId(handle: string): string {
  return `rumble:${handle.trim().toLowerCase()}`;
}

class RumbleClient {
  private async request<T>(path: string): Promise<T> {
    const response = await fetch(`${config.RUMBLE_API_BASE_URL}${path}`, {
      headers: config.RUMBLE_API_KEY
        ? { authorization: `Bearer ${config.RUMBLE_API_KEY}` }
        : undefined,
    });
    if (!response.ok) {
      throw new Error(`Rumble API request failed with ${response.status}`);
    }
    return await response.json() as T;
  }

  async getCreator(handle: string): Promise<RumbleCreatorMetadata> {
    if (!config.RUMBLE_API_KEY) {
      return {
        id: deriveRumbleCreatorId(handle),
        handle,
      };
    }
    return this.request<RumbleCreatorMetadata>(`/creators/${encodeURIComponent(handle)}`);
  }

  async getVideo(videoId: string): Promise<RumbleVideoMetadata> {
    return this.request<RumbleVideoMetadata>(`/videos/${encodeURIComponent(videoId)}`);
  }
}

export const rumbleClient = new RumbleClient();
