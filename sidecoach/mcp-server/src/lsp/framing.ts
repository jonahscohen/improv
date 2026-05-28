// T-0026: LSP wire-protocol framing.
//
// The Language Server Protocol frames each JSON-RPC message with an HTTP-style
// header block terminated by a blank line, then a JSON body of exactly
// `Content-Length` bytes:
//
//     Content-Length: 123\r\n
//     \r\n
//     {"jsonrpc":"2.0",...}
//
// This module is pure (no I/O) so it can be unit-tested against partial reads,
// concatenated messages, bad Content-Length headers, and non-JSON bodies
// without spawning a real language server.

/** A single decoded frame: either a parsed message OR a framing/parse error. */
export interface DecodedFrame {
  /** Present when the body parsed as JSON. */
  message?: unknown;
  /** Present when the frame could not be decoded (bad header or non-JSON body). */
  error?: string;
}

/**
 * Encode a JSON-RPC object into a Content-Length framed buffer.
 * The length is the BYTE length of the UTF-8 body, not the character count -
 * a multi-byte body with the wrong length would desync the peer's reader.
 */
export function encodeMessage(obj: unknown): Buffer {
  const body = Buffer.from(JSON.stringify(obj), 'utf8');
  const header = Buffer.from(`Content-Length: ${body.length}\r\n\r\n`, 'ascii');
  return Buffer.concat([header, body]);
}

/** Default hard cap on a single message body. Guards against a malicious or
 *  broken peer announcing a multi-gigabyte Content-Length. */
const DEFAULT_MAX_MESSAGE_BYTES = 16 * 1024 * 1024; // 16 MiB

const HEADER_SEPARATOR = '\r\n\r\n';

/**
 * Incremental framing reader. Feed it raw chunks from a transport via push();
 * it returns zero or more fully-decoded frames per call and retains any partial
 * remainder for the next chunk.
 *
 * Robustness contract (each maps to a fault-injection test):
 *  - Partial reads: a body split across chunks reassembles correctly.
 *  - Concatenated messages: multiple frames in one chunk all decode.
 *  - Missing/invalid Content-Length: emits an error frame and resyncs past the
 *    bad header block instead of hanging or throwing.
 *  - Non-JSON body: emits an error frame; the reader stays usable.
 *  - Oversized Content-Length: emits an error frame and drops the header so a
 *    hostile length can't pin memory.
 */
export class LspFramer {
  private buf: Buffer = Buffer.alloc(0);
  private readonly maxMessageBytes: number;

  constructor(opts: { maxMessageBytes?: number } = {}) {
    this.maxMessageBytes = opts.maxMessageBytes ?? DEFAULT_MAX_MESSAGE_BYTES;
  }

  /** Append a chunk and return any frames that are now complete. */
  public push(chunk: Buffer): DecodedFrame[] {
    this.buf = this.buf.length === 0 ? chunk : Buffer.concat([this.buf, chunk]);
    const frames: DecodedFrame[] = [];

    for (;;) {
      const sepIdx = this.buf.indexOf(HEADER_SEPARATOR);
      if (sepIdx === -1) {
        // Headers not yet complete. Wait for more bytes - unless the buffer has
        // grown unreasonably large without a separator (a peer streaming junk).
        if (this.buf.length > this.maxMessageBytes) {
          frames.push({ error: 'header block exceeded max size without terminator' });
          this.buf = Buffer.alloc(0);
        }
        break;
      }

      const headerText = this.buf.slice(0, sepIdx).toString('utf8');
      const match = headerText.match(/Content-Length:\s*(\d+)/i);
      if (!match) {
        // Unrecoverable header (no valid Content-Length). Emit an error and
        // resync past this header block so one bad frame doesn't wedge us.
        frames.push({
          error: `missing or invalid Content-Length in header: ${headerText.slice(0, 80)}`,
        });
        this.buf = this.buf.slice(sepIdx + HEADER_SEPARATOR.length);
        continue;
      }

      const contentLength = Number(match[1]);
      if (!Number.isFinite(contentLength) || contentLength > this.maxMessageBytes) {
        frames.push({ error: `Content-Length ${match[1]} exceeds max ${this.maxMessageBytes}` });
        this.buf = this.buf.slice(sepIdx + HEADER_SEPARATOR.length);
        continue;
      }

      const bodyStart = sepIdx + HEADER_SEPARATOR.length;
      if (this.buf.length < bodyStart + contentLength) {
        // Body not fully arrived yet. Keep the buffer intact and wait.
        break;
      }

      const body = this.buf.slice(bodyStart, bodyStart + contentLength).toString('utf8');
      this.buf = this.buf.slice(bodyStart + contentLength);
      try {
        frames.push({ message: JSON.parse(body) });
      } catch {
        frames.push({ error: `non-JSON body (${contentLength} bytes)` });
      }
    }

    return frames;
  }

  /** Bytes currently buffered awaiting a complete frame. Test/diagnostic seam. */
  public pendingBytes(): number {
    return this.buf.length;
  }

  /** Drop any buffered partial data. */
  public reset(): void {
    this.buf = Buffer.alloc(0);
  }
}
