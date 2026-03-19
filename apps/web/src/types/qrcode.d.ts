declare module 'qrcode' {
  export interface QRCodeToDataURLOptions {
    margin?: number;
    width?: number;
    color?: {
      dark?: string;
      light?: string;
    };
  }

  const QRCode: {
    toDataURL(value: string, options?: QRCodeToDataURLOptions): Promise<string>;
  };

  export default QRCode;
}
