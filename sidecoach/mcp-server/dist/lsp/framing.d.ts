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
export declare function encodeMessage(obj: unknown): Buffer;
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
export declare class LspFramer {
    private buf;
    private readonly maxMessageBytes;
    constructor(opts?: {
        maxMessageBytes?: number;
    });
    /** Append a chunk and return any frames that are now complete. */
    push(chunk: Buffer): DecodedFrame[];
    /** Bytes currently buffered awaiting a complete frame. Test/diagnostic seam. */
    pendingBytes(): number;
    /** Drop any buffered partial data. */
    reset(): void;
}
//# sourceMappingURL=framing.d.ts.map