declare module 'qrcode' {
  export type QRCodeToDataURLOptions = {
    /** Quiet zone around the QR code (default varies). */
    margin?: number;
    /** Output image width in pixels. */
    width?: number;
    /** Scale factor for modules. */
    scale?: number;
  };

  export function toDataURL(text: string, options?: QRCodeToDataURLOptions): Promise<string>;

  const QRCode: {
    toDataURL: typeof toDataURL;
  };

  export default QRCode;
}

