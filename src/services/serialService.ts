// Marine NMEA 0183 Serial Service (WebSerial + WebUSB)
// 100% Offline Local Operation - ZERO External GitHub Dependencies!
import { webUsbDriver } from './webUsbDriver';

export interface SerialPortInfo {
  usbVendorId?: number;
  usbProductId?: number;
}

class MarineSerialService {
  private port: any = null;
  private reader: any = null;
  private writer: any = null;
  private isReading = false;
  private onSentenceCallback: ((sentence: string) => void) | null = null;
  private buffer = '';

  public isWebSerialSupported(): boolean {
    return typeof navigator !== 'undefined' && 'serial' in navigator;
  }

  public isWebUsbSupported(): boolean {
    return webUsbDriver.isSupported();
  }

  public isAnyUsbSupported(): boolean {
    return this.isWebSerialSupported() || this.isWebUsbSupported();
  }

  public getLocalLoopbackUrl(): string {
    if (typeof window !== 'undefined') {
      return window.location.href;
    }
    return 'http://localhost:3000';
  }

  public async connect(baudRate = 4800): Promise<{ mode: 'serial' | 'webusb' }> {
    // 1. Try Web Serial API first (Standard Chrome Android / Desktop)
    if (this.isWebSerialSupported()) {
      try {
        const nav = navigator as any;
        this.port = await nav.serial.requestPort({
          filters: [
            { usbVendorId: 0x1a86 }, // CH340 / CH341
            { usbVendorId: 0x10c4 }, // CP2102
            { usbVendorId: 0x0403 }, // FTDI
            { usbVendorId: 0x067b }, // Prolific PL2303
            { usbVendorId: 0x2341 }  // Arduino
          ]
        });

        await this.port.open({
          baudRate,
          dataBits: 8,
          stopBits: 1,
          parity: 'none',
          bufferSize: 4096
        });

        this.startReadingWebSerial();
        return { mode: 'serial' };
      } catch (err: any) {
        if (err.name === 'NotFoundError') {
          throw new Error('دستگاهی توسط کاربر انتخاب نشد.');
        }
        console.warn('WebSerial request failed, trying WebUSB fallback:', err);
      }
    }

    // 2. Fallback to Direct WebUSB
    if (this.isWebUsbSupported()) {
      webUsbDriver.setOnData((chunk) => {
        this.handleIncomingChunk(chunk);
      });
      const connected = await webUsbDriver.requestAndConnect(baudRate);
      if (connected) {
        return { mode: 'webusb' };
      }
    }

    throw new Error('اتصال به پورت سریال یا USB ممکن نشد. لطفاً دسترسی USB OTG را بررسی فرمایید.');
  }

  public setOnSentence(cb: (sentence: string) => void) {
    this.onSentenceCallback = cb;
  }

  private handleIncomingChunk(chunk: string) {
    this.buffer += chunk;
    const lines = this.buffer.split(/\r?\n/);
    this.buffer = lines.pop() || ''; // Keep incomplete part in buffer

    for (const line of lines) {
      const trimmed = line.trim();
      if ((trimmed.startsWith('$') || trimmed.startsWith('!')) && this.onSentenceCallback) {
        this.onSentenceCallback(trimmed);
      }
    }
  }

  private async startReadingWebSerial() {
    if (!this.port || !this.port.readable) return;
    this.isReading = true;

    try {
      const textDecoder = new TextDecoderStream();
      const readableStreamClosed = this.port.readable.pipeTo(textDecoder.writable);
      this.reader = textDecoder.readable.getReader();

      while (this.isReading) {
        const { value, done } = await this.reader.read();
        if (done) break;
        if (value) {
          this.handleIncomingChunk(value);
        }
      }
    } catch (err) {
      console.warn('WebSerial read loop error:', err);
    } finally {
      this.isReading = false;
    }
  }

  public async sendSentence(sentence: string): Promise<boolean> {
    const payload = sentence.endsWith('\r\n') ? sentence : `${sentence}\r\n`;

    // 1. Try Web Serial write
    if (this.port && this.port.writable) {
      try {
        const encoder = new TextEncoder();
        const writer = this.port.writable.getWriter();
        await writer.write(encoder.encode(payload));
        writer.releaseLock();
        return true;
      } catch (err) {
        console.error('WebSerial write error:', err);
      }
    }

    // 2. Try WebUSB write
    if (webUsbDriver.isConnected()) {
      return await webUsbDriver.sendData(payload);
    }

    return false;
  }

  public async disconnect(): Promise<void> {
    this.isReading = false;

    if (this.reader) {
      try {
        await this.reader.cancel();
      } catch {}
      this.reader = null;
    }

    if (this.port) {
      try {
        await this.port.close();
      } catch {}
      this.port = null;
    }

    if (webUsbDriver.isConnected()) {
      await webUsbDriver.disconnect();
    }
  }

  public isConnected(): boolean {
    return (!!this.port && !!this.port.readable) || webUsbDriver.isConnected();
  }
}

export const serialService = new MarineSerialService();
