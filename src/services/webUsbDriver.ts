import { NmeaLogEntry, SerialPortStatus } from '../types';
import { parseNmeaSentence } from '../utils/nmea';

// CH340 / CP2102 / FTDI / PL2303 Vendor IDs
export const USB_VENDOR_IDS = [
  { vendorId: 0x1a86, name: 'CH340 / CH341 (WCH)' },
  { vendorId: 0x10c4, name: 'CP2102 / CP2104 (Silicon Labs)' },
  { vendorId: 0x0403, name: 'FT232 / FTDI' },
  { vendorId: 0x067b, name: 'PL2303 (Prolific)' },
  { vendorId: 0x2341, name: 'Arduino' },
  { vendorId: 0x303a, name: 'ESP32' },
  { vendorId: 0x2e8a, name: 'Raspberry Pi Pico' },
  { vendorId: 0x0483, name: 'STM32' },
];

export class WebUsbDriver {
  private device: any = null;
  private interfaceNumber = 0;
  private endpointIn = 0;
  private endpointOut = 0;
  private keepReading = false;

  public isSupported(): boolean {
    return typeof navigator !== 'undefined' && 'usb' in navigator;
  }

  public async requestAndOpen(baudRate: number = 4800): Promise<{
    name: string;
    vendorId: string;
    productId: string;
  }> {
    if (!this.isSupported()) {
      throw new Error('WebUSB is not supported in this browser.');
    }

    // Request device without vendor restriction so all connected OTG adapters show up
    this.device = await (navigator as any).usb.requestDevice({ filters: [] });

    await this.device.open();
    if (this.device.configuration === null) {
      await this.device.selectConfiguration(1);
    }

    // Find first interface with Bulk IN and Bulk OUT endpoints
    const config = this.device.configuration;
    let foundInterface = false;

    if (config) {
      for (const iface of config.interfaces) {
        for (const alt of iface.alternates) {
          let inEp = 0;
          let outEp = 0;
          for (const ep of alt.endpoints) {
            if (ep.direction === 'in' && ep.type === 'bulk') {
              inEp = ep.endpointNumber;
            } else if (ep.direction === 'out' && ep.type === 'bulk') {
              outEp = ep.endpointNumber;
            }
          }
          if (inEp > 0 || outEp > 0) {
            this.interfaceNumber = iface.interfaceNumber;
            this.endpointIn = inEp || 1;
            this.endpointOut = outEp || 2;
            foundInterface = true;
            break;
          }
        }
        if (foundInterface) break;
      }
    }

    try {
      await this.device.claimInterface(this.interfaceNumber);
    } catch (e) {
      console.warn('Could not claim interface immediately:', e);
    }

    // Initialize CH340 / USB UART baud rate via control transfer
    await this.initBaudRate(baudRate);

    const vendorHex = `0x${this.device.vendorId.toString(16).toUpperCase().padStart(4, '0')}`;
    const productHex = `0x${this.device.productId.toString(16).toUpperCase().padStart(4, '0')}`;
    const matchedVendor = USB_VENDOR_IDS.find((v) => v.vendorId === this.device?.vendorId);
    const name = matchedVendor ? matchedVendor.name : this.device.productName || 'USB Serial Adapter';

    return {
      name,
      vendorId: vendorHex,
      productId: productHex,
    };
  }

  private async initBaudRate(baudRate: number) {
    if (!this.device) return;

    try {
      // 1. Standard USB CDC-ACM Set Line Coding (Baud rate, 1 stop bit, no parity, 8 data bits)
      // Line coding buffer: [dwDTERate (4 bytes uint32 le), bCharFormat (1 byte), bParityType (1 byte), bDataBits (1 byte)]
      const lineCoding = new ArrayBuffer(7);
      const view = new DataView(lineCoding);
      view.setUint32(0, baudRate, true); // baud rate (e.g. 4800)
      view.setUint8(4, 0); // 1 stop bit
      view.setUint8(5, 0); // no parity
      view.setUint8(6, 8); // 8 data bits

      // Attempt CDC ACM Set Line Coding
      await this.device.controlTransferOut(
        {
          requestType: 'class',
          recipient: 'interface',
          request: 0x20, // SET_LINE_CODING
          value: 0x0000,
          index: this.interfaceNumber,
        },
        lineCoding
      ).catch(() => {});

      // CDC ACM Set Control Line State (DTR = 1, RTS = 1)
      await this.device.controlTransferOut({
        requestType: 'class',
        recipient: 'interface',
        request: 0x22, // SET_CONTROL_LINE_STATE
        value: 0x0003,
        index: this.interfaceNumber,
      }).catch(() => {});

      // 2. CH340 / CH341 initialization sequence (Vendor ID 0x1A86)
      if (this.device.vendorId === 0x1a86) {
        await this.device.controlTransferOut({
          requestType: 'vendor',
          recipient: 'device',
          request: 0xa1,
          value: 0xc29c,
          index: 0xb2b9,
        }).catch(() => {});

        // Set baud rate factor for 4800 / 9600 / 38400 / 115200
        let factor = 0x6402;
        if (baudRate === 9600) factor = 0xb202;
        else if (baudRate === 19200) factor = 0xd902;
        else if (baudRate === 38400) factor = 0x6403;
        else if (baudRate === 115200) factor = 0xcc03;

        await this.device.controlTransferOut({
          requestType: 'vendor',
          recipient: 'device',
          request: 0x9a,
          value: 0x1312,
          index: factor,
        }).catch(() => {});

        await this.device.controlTransferOut({
          requestType: 'vendor',
          recipient: 'device',
          request: 0xa4,
          value: 0x00ff,
          index: 0,
        }).catch(() => {});
      }
      // 3. Silicon Labs CP2102 / CP2104 (Vendor ID 0x10C4)
      else if (this.device.vendorId === 0x10c4) {
        await this.device.controlTransferOut({
          requestType: 'vendor',
          recipient: 'interface',
          request: 0x00, // IFC_ENABLE
          value: 0x0001,
          index: this.interfaceNumber,
        }).catch(() => {});

        // Set baud rate on CP2102
        const baudBuffer = new ArrayBuffer(4);
        new DataView(baudBuffer).setUint32(0, baudRate, true);
        await this.device.controlTransferOut(
          {
            requestType: 'vendor',
            recipient: 'interface',
            request: 0x1e, // CP210X_SET_BAUDRATE
            value: 0x0000,
            index: this.interfaceNumber,
          },
          baudBuffer
        ).catch(() => {});
      }
      // 4. FTDI FT232R / FT232H (Vendor ID 0x0403)
      else if (this.device.vendorId === 0x0403) {
        // Reset FTDI
        await this.device.controlTransferOut({
          requestType: 'vendor',
          recipient: 'device',
          request: 0x00, // SIO_RESET
          value: 0x0000,
          index: this.interfaceNumber + 1,
        }).catch(() => {});

        // Set baud rate divisor
        let divisor = 0x4138; // for 4800 baud on 3MHz FTDI clock
        if (baudRate === 9600) divisor = 0x411c;
        else if (baudRate === 38400) divisor = 0x004e;
        else if (baudRate === 115200) divisor = 0x001a;

        await this.device.controlTransferOut({
          requestType: 'vendor',
          recipient: 'device',
          request: 0x03, // SIO_SET_BAUDRATE
          value: divisor,
          index: this.interfaceNumber + 1,
        }).catch(() => {});
      }
    } catch (err) {
      console.warn('Vendor-specific baud init notice:', err);
    }
  }

  public async startReading(onData: (chunk: string) => void) {
    if (!this.device || !this.endpointIn) return;
    this.keepReading = true;

    const decoder = new TextDecoder();
    while (this.keepReading && this.device) {
      try {
        const result = await this.device.transferIn(this.endpointIn, 64);
        if (result.data && result.data.byteLength > 0) {
          const text = decoder.decode(result.data);
          if (text) {
            onData(text);
          }
        }
      } catch (err) {
        if (this.keepReading) {
          await new Promise((r) => setTimeout(r, 100));
        }
      }
    }
  }

  public async write(text: string): Promise<boolean> {
    if (!this.device || !this.endpointOut) return false;
    try {
      const encoder = new TextEncoder();
      const data = encoder.encode(text);
      await this.device.transferOut(this.endpointOut, data);
      return true;
    } catch (err) {
      console.warn('WebUSB write error:', err);
      return false;
    }
  }

  public async close() {
    this.keepReading = false;
    if (this.device) {
      try {
        await this.device.releaseInterface(this.interfaceNumber);
        await this.device.close();
      } catch (e) {}
      this.device = null;
    }
  }
}
