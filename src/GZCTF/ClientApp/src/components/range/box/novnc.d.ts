// The part of noVNC's client (RFB) that the attack box's Firefox window uses: noVNC ships
// without types.
declare module '@novnc/novnc' {
  export interface RFBOptions {
    shared?: boolean
    credentials?: { username?: string; password?: string; target?: string }
    wsProtocols?: string[]
  }

  export default class RFB extends EventTarget {
    constructor(target: HTMLElement, urlOrChannel: string | WebSocket, options?: RFBOptions)
    background: string
    clipViewport: boolean
    compressionLevel: number
    focusOnClick: boolean
    qualityLevel: number
    resizeSession: boolean
    scaleViewport: boolean
    showDotCursor: boolean
    viewOnly: boolean
    blur(): void
    clipboardPasteFrom(text: string): void
    disconnect(): void
    focus(options?: FocusOptions): void
    sendKey(keysym: number, code: string | null, down?: boolean): void
  }
}
