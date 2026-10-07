// Direct WebUSB Driver for NMEA 0183 Transceivers (CH340, CP2102, FTDI, PL2303, Arduino)
// Zero external links - 100% Offline Local Operation

export interface UsbDeviceInfo {
  vendorId: number;
  productId: number;
  productName?: string;
  manufacturerName?: string;
}

export class WebUsbNmeaDriver {
  private device: any = null;
  private interfaceNumber = 0;
  private endpointIn = 0;
  private endpointOut = 0;
  private isReading = false;
  private onDataCallback: ((chunk: string) => void) | null = null;
  private textDecoder = new TextDecoder();

  public isSupported(): boolean {
    return typeof navigator !== 'undefined' && 'usb' in navigator;
  }

  public async requestAndConnect(baudRate = 4800): Promise<boolean> {
    if (!this.isSupported()) {
      throw new Error('WebUSB is not supported in this browser.');
    }

    try {
      const nav = navigator as any;
      // Request any USB device or known serial converters
      this.device = await nav.usb.requestDevice({
        filters: [
          { vendorId: 0x1a86 }, // CH340 / CH341
          { vendorId: 0x10c4 }, // CP2102
          { vendorId: 0x0403 }, // FTDI
          { vendorId: 0x067b }, // Prolific PL2303
          { vendorId: 0x2341 }  // Arduino
        ]
      });

      if (!this.device) return false;

      await this.device.open();
      if (this.device.configuration === null) {
        await this.device.selectConfiguration(1);
      }

      // Find bulk endpoints
      const iface = this.device.configuration?.interfaces[0];
      if (iface) {
        this.interfaceNumber = iface.interfaceNumber;
        await this.device.claimInterface(this.interfaceNumber);

        const endpoints = iface.alternate.endpoints;
        for (const ep of endpoints) {
          if (ep.direction === 'in') this.endpointIn = ep.endpointNumber;
          if (ep.direction === 'out') this.endpointOut = ep.endpointNumber;
        }
      }

      this.startReading();
      return true;
    } catch (err) {
      console.error('WebUSB connection error:', err);
      throw err;
    }
  }

  public setOnData(cb: (chunk: string) => void) {
    this.onDataCallback = cb;
  }

  private async startReading() {
    if (!this.device || !this.endpointIn) return;
    this.isReading = true;

    while (this.isReading && this.device?.opened) {
      try {
        const result = await this.device.transferIn(this.endpointIn, 64);
        if (result.data && result.data.byteLength > 0) {
          const str = this.textDecoder.decode(result.data);
          if (this.onDataCallback) {
            this.onDataCallback(str);
          }
        }
      } catch (err) {
        if (!this.isReading) break;
        await new Promise((r) => setTimeout(r, 100));
      }
    }
  }

  public async sendData(text: string): Promise<boolean> {
    if (!this.device || !this.device.opened || !this.endpointOut) return false;
    try {
      const encoder = new TextEncoder();
      const data = encoder.encode(text);
      await this.device.transferOut(this.endpointOut, data);
      return true;
    } catch (err) {
      console.error('WebUSB send error:', err);
      return false;
    }
  }

  public async disconnect(): Promise<void> {
    this.isReading = false;
    if (this.device && this.device.opened) {
      try {
        await this.device.releaseInterface(this.interfaceNumber);
        await this.device.close();
      } catch {}
    }
    this.device = null;
  }

  public isConnected(): boolean {
    return !!this.device && !!this.device.opened;
  }
}

export const webUsbDriver = new WebUsbNmeaDriver();
