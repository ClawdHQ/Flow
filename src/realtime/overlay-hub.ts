import { EventEmitter } from 'events';
import type { OverlayEventPayload } from '../types/flow.js';

class OverlayHub extends EventEmitter {
  publish(event: OverlayEventPayload): void {
    this.emit('overlay', event);
  }

  subscribe(listener: (event: OverlayEventPayload) => void): () => void {
    this.on('overlay', listener);
    return () => this.off('overlay', listener);
  }
}

export const overlayHub = new OverlayHub();
