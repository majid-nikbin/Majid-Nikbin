import { NmeaLogEntry, SerialPortStatus } from '../types';
import { parseNmeaSentence } from '../utils/nmea';
import { WebUsbDriver } from './webUsbDriver';

export interface KnownUsbDriver {
  vendorId: number;
  vendorHex: string;
  name: string;
  chipsets: string;
}

export const KNOWN_USB_DRIVERS: KnownUsbDriver[] = [
  { vendorId: 0x1a86, vendorHex: '0x1A86', name: 'WCH / QinHeng', chipsets: 'CH340, CH341, CH9102, MAX485' },
  { vendorId: 0x10c4, vendorHex: '0x10C4', name: 'Silicon Labs', chipsets: 'CP2102, CP2104, CP2108, CP2109' },
  { vendorId: 0x0403, vendorHex: '0x0403', name: 'FTDI', chipsets: 'FT232R, FT232H, FT2232, FT4232' },
  { vendorId: 0x067b, vendorHex: '0x067B', name: 'Prolific', chipsets: 'PL2303, PL2303HX, PL2303RA' },
  { vendorId: 0x2341, vendorHex: '0x2341', name: 'Arduino / CDC', chipsets: 'Uno, Mega, Leonardo, Due' },
  { vendorId: 0x303a, vendorHex: '0x303A', name: 'Espressif', chipsets: 'ESP32-S2/S3 USB-JTAG/CDC' },
  { vendorId: 0x2e8a, vendorHex: '0x2E8A', name: 'Raspberry Pi', chipsets: 'RP2040, Pico USB Serial' },
  { vendorId: 0x0483, vendorHex: '0x0483', name: 'STMicroelectronics', chipsets: 'STM32 Virtual COM Port' },
];

type StatusListener = (status: SerialPortStatus) => void;
type LogListener = (entry: NmeaLogEntry) => void;

class SerialService {
  private port: any = null;
  private reader: any = null;
  private usbDriver: WebUsbDriver | null = null;
  private isUsingWebUsb = false;
  private keepReading = false;
  private statusListeners: Set<StatusListener> = new Set();
  private logListeners: Set<LogListener> = new Set();

  private status: SerialPortStatus = {
    connected: false,
    baudRate: 4800,
    bytesSent: 0,
    bytesReceived: 0,
    sentencesSent: 0,
    sentencesReceived: 0,
    isSimulated: false,
  };

  private simInterval: any = null;
  private rxBuffer = '';

  constructor() {
    if (typeof navigator !== 'undefined' && 'serial' in navigator) {
      (navigator as any).serial.addEventListener('disconnect', (event: any) => {
        if (this.port === event.target) {
          this.disconnect();
        }
      });
    }
  }

  public isWebSerialSupported(): boolean {
    return typeof navigator !== 'undefined' && 'serial' in navigator;
  }

  public isWebUsbSupported(): boolean {
    return typeof navigator !== 'undefined' && 'usb' in navigator;
  }

  public getStatus(): SerialPortStatus {
    return { ...this.status };
  }

  public subscribeStatus(cb: StatusListener): () => void {
    this.statusListeners.add(cb);
    cb(this.getStatus());
    return () => this.statusListeners.delete(cb);
  }

  public subscribeLog(cb: LogListener): () => void {
    this.logListeners.add(cb);
    return () => this.logListeners.delete(cb);
  }

  private notifyStatus() {
    const s = this.getStatus();
    this.statusListeners.forEach((cb) => cb(s));
  }

  private notifyLog(entry: NmeaLogEntry) {
    this.logListeners.forEach((cb) => cb(entry));
  }

  /**
   * Connect via WebUSB (Best for Android Chrome & CH340/MAX485/FTDI)
   */
  public async connectWebUsb(baudRate: number = 4800): Promise<boolean> {
    this.disconnect();
    this.usbDriver = new WebUsbDriver();

    try {
      const devInfo = await this.usbDriver.requestAndOpen(baudRate);
      this.isUsingWebUsb = true;

      this.status = {
        connected: true,
        portName: `${devInfo.name} (${baudRate} baud)`,
        baudRate,
        driverType: `WebUSB: ${devInfo.name}`,
        vendorId: devInfo.vendorId,
        productId: devInfo.productId,
        bytesSent: 0,
        bytesReceived: 0,
        sentencesSent: 0,
        sentencesReceived: 0,
        isSimulated: false,
        error: undefined,
      };
      this.notifyStatus();

      this.usbDriver.startReading((chunk) => {
        this.status.bytesReceived += chunk.length;
        this.handleIncomingRawText(chunk);
      });

      return true;
    } catch (err: any) {
      this.isUsingWebUsb = false;
      this.status = {
        ...this.status,
        connected: false,
        error: err?.message || 'WebUSB connection failed',
      };
      this.notifyStatus();
      throw err;
    }
  }

  /**
   * Connect via Web Serial API (Desktop / CDC ACM)
   */
  public async connectWebSerial(baudRate: number = 4800): Promise<boolean> {
    if (!this.isWebSerialSupported()) {
      throw new Error('Web Serial API is not supported on this browser engine.');
    }

    try {
      try {
        this.port = await (navigator as any).serial.requestPort();
      } catch (e) {
        this.port = await (navigator as any).serial.requestPort({});
      }

      const info = this.port.getInfo ? this.port.getInfo() : {};
      const vendorHex = info.usbVendorId ? `0x${info.usbVendorId.toString(16).toUpperCase()}` : undefined;
      const productHex = info.usbProductId ? `0x${info.usbProductId.toString(16).toUpperCase()}` : undefined;
      
      const matchedDriver = KNOWN_USB_DRIVERS.find((d) => d.vendorId === info.usbVendorId);
      const driverType = matchedDriver
        ? `${matchedDriver.name} (${matchedDriver.chipsets})`
        : vendorHex
        ? `USB Serial (${vendorHex})`
        : 'Generic USB-UART';

      await this.port.open({
        baudRate,
        dataBits: 8,
        stopBits: 1,
        parity: 'none',
        flowControl: 'none',
      });

      this.isUsingWebUsb = false;
      this.status = {
        connected: true,
        portName: `USB OTG Serial (${baudRate} baud)`,
        baudRate,
        driverType,
        vendorId: vendorHex,
        productId: productHex,
        bytesSent: 0,
        bytesReceived: 0,
        sentencesSent: 0,
        sentencesReceived: 0,
        isSimulated: false,
        error: undefined,
      };
      this.notifyStatus();

      this.startReading();
      return true;
    } catch (err: any) {
      this.status = {
        ...this.status,
        connected: false,
        error: err?.message || 'Connection cancelled or failed',
      };
      this.notifyStatus();
      throw err;
    }
  }

  /**
   * Smart connect: Tries WebUSB first (best for Android CH340), then falls back to Web Serial
   */
  public async connect(baudRate: number = 4800): Promise<boolean> {
    if (this.isWebUsbSupported()) {
      try {
        return await this.connectWebUsb(baudRate);
      } catch (usbErr: any) {
        if (usbErr.name === 'NotFoundError' || usbErr.message?.includes('No device selected')) {
          throw usbErr;
        }
        // Fallback to WebSerial if WebUSB fails
        if (this.isWebSerialSupported()) {
          return await this.connectWebSerial(baudRate);
        }
        throw usbErr;
      }
    } else if (this.isWebSerialSupported()) {
      return await this.connectWebSerial(baudRate);
    } else {
      throw new Error('Neither WebUSB nor Web Serial is supported in this browser.');
    }
  }

  /**
   * Connect in Simulated Mode (for testing/preview or devices without physical USB plugged in)
   */
  public connectSimulated(baudRate: number = 4800) {
    this.disconnect();
    this.status = {
      connected: true,
      portName: `Virtual OTG Bridge (${baudRate} baud)`,
      baudRate,
      driverType: 'Virtual NMEA 0183 Loopback Simulator',
      vendorId: '0x1A86 (Simulated MAX485/CH340)',
      productId: '0x7523',
      bytesSent: 0,
      bytesReceived: 0,
      sentencesSent: 0,
      sentencesReceived: 0,
      isSimulated: true,
      error: undefined,
    };
    this.notifyStatus();

    let simHeading = 45;
    this.simInterval = setInterval(() => {
      if (!this.status.connected || !this.status.isSimulated) return;
      simHeading = (simHeading + 0.4) % 360;
      const hdgStr = simHeading.toFixed(1);
      const testSentence = `$HEHDT,${hdgStr},T*${(simHeading > 180 ? '2A' : '1F')}`;
      
      const parsed = parseNmeaSentence(testSentence);
      this.status.bytesReceived += testSentence.length;
      this.status.sentencesReceived += 1;
      this.notifyStatus();

      this.notifyLog({
        id: Math.random().toString(36).substring(2, 9),
        timestamp: new Date().toISOString().substring(11, 19),
        direction: 'RX',
        raw: testSentence,
        sentenceType: parsed.type,
        isValidChecksum: parsed.isValid,
        parsedSummary: parsed.summary,
      });
    }, 2000);
  }

  private async startReading() {
    this.keepReading = true;
    this.rxBuffer = '';

    while (this.port && this.port.readable && this.keepReading) {
      try {
        const textDecoder = new TextDecoderStream();
        const readableStreamClosed = this.port.readable.pipeTo(textDecoder.writable);
        const reader = textDecoder.readable.getReader();
        this.reader = reader;

        while (this.keepReading) {
          const { value, done } = await reader.read();
          if (done) break;
          if (value) {
            this.status.bytesReceived += value.length;
            this.handleIncomingRawText(value);
          }
        }

        reader.releaseLock();
        await readableStreamClosed.catch(() => {});
      } catch (err: any) {
        if (this.keepReading) {
          console.warn('Serial read error:', err);
        }
        break;
      }
    }
  }

  private handleIncomingRawText(chunk: string) {
    this.rxBuffer += chunk;
    const lines = this.rxBuffer.split(/\r\n|\n|\r/);
    this.rxBuffer = lines.pop() || '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.length > 0) {
        this.status.sentencesReceived += 1;
        const parsed = parseNmeaSentence(trimmed);
        this.notifyLog({
          id: Math.random().toString(36).substring(2, 9),
          timestamp: new Date().toISOString().substring(11, 19),
          direction: 'RX',
          raw: trimmed,
          sentenceType: parsed.type,
          isValidChecksum: parsed.isValid,
          parsedSummary: parsed.summary,
        });
      }
    }
    this.notifyStatus();
  }

  /**
   * Send NMEA sentences over USB OTG serial / WebUSB
   */
  public async writeSentences(sentences: string[]): Promise<boolean> {
    if (!this.status.connected) return false;

    const payload = sentences.join('');
    const now = new Date().toISOString().substring(11, 19);

    // Record in log
    for (const s of sentences) {
      const trimmed = s.trim();
      const parsed = parseNmeaSentence(trimmed);
      this.notifyLog({
        id: Math.random().toString(36).substring(2, 9),
        timestamp: now,
        direction: 'TX',
        raw: trimmed,
        sentenceType: parsed.type,
        isValidChecksum: parsed.isValid,
        parsedSummary: parsed.summary,
      });
      this.status.sentencesSent += 1;
      this.status.bytesSent += s.length;
    }
    this.notifyStatus();

    if (this.status.isSimulated) {
      return true;
    }

    // If connected via WebUSB
    if (this.isUsingWebUsb && this.usbDriver) {
      return await this.usbDriver.write(payload);
    }

    // If connected via WebSerial
    if (this.port && this.port.writable) {
      try {
        const textEncoder = new TextEncoderStream();
        const writableStreamClosed = textEncoder.readable.pipeTo(this.port.writable);
        const writer = textEncoder.writable.getWriter();
        await writer.write(payload);
        await writer.close();
        await writableStreamClosed;
        return true;
      } catch (err: any) {
        console.error('Serial write failed:', err);
        return false;
      }
    }

    return false;
  }

  /**
   * Disconnect and release USB port
   */
  public async disconnect() {
    this.keepReading = false;
    if (this.simInterval) {
      clearInterval(this.simInterval);
      this.simInterval = null;
    }

    if (this.usbDriver) {
      try {
        await this.usbDriver.close();
      } catch (e) {}
      this.usbDriver = null;
    }

    if (this.reader) {
      try {
        await this.reader.cancel();
      } catch (e) {}
      this.reader = null;
    }

    if (this.port) {
      try {
        await this.port.close();
      } catch (e) {}
      this.port = null;
    }

    this.isUsingWebUsb = false;
    this.status = {
      connected: false,
      baudRate: this.status.baudRate,
      bytesSent: 0,
      bytesReceived: 0,
      sentencesSent: 0,
      sentencesReceived: 0,
      isSimulated: false,
      error: undefined,
    };
    this.notifyStatus();
  }
}

export const serialService = new SerialService();
