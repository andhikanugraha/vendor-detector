import { Duplex } from 'stream';

export interface DetectionResult {
  type: string,
  vendor: string,
  product?: string,
  hostname?: string,
  url?: string,
  message?: string
}
