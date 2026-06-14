# SHA-256 Crypto Module

## What It Does

Provides SHA-256 hashing functionality using the Web Crypto API for the Exam Activity Monitoring system. Used to hash copy/paste content without storing the actual text, ensuring privacy-preserving telemetry collection.

## How to Verify It Works

### Run Unit Tests

```bash
cd client && deno test src/crypto_test.ts
```

Expected output:
```
running 4 tests from ./src/crypto_test.ts
sha256 returns correct hash for empty string ... ok
sha256 returns correct hash for 'hello' ... ok
sha256 returns hex string of length 64 ... ok
sha256 returns different hashes for different inputs ... ok

ok | 4 passed | 0 failed
```

### Manual Verification

```typescript
import { sha256 } from "./client/src/crypto.ts";

// Test with known vector
const hash = await sha256("hello");
console.log(hash);
// Expected: 2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824
```

## API

### `sha256(message: string): Promise<string>`

Computes SHA-256 hash of input string.

**Parameters:**
- `message` - The string to hash

**Returns:**
- Promise resolving to lowercase 64-character hexadecimal hash string

**Example:**
```typescript
const hash = await sha256("Hello, World!");
// => "dffd6021bb2bd5b0af676290809ec3a53191dd81c7f70a4b28688a362182986f"
```

## Known Limitations

1. **Browser-only**: Uses Web Crypto API (`crypto.subtle`), which requires a secure context (HTTPS or localhost)
2. **Async operation**: Returns a Promise due to Web Crypto API's async nature
3. **No streaming**: Processes entire input at once - not suitable for very large strings (but fine for typical paste content)

## Privacy & Security

This module is a critical privacy component:
- **Never stores text** - only produces fixed-length hashes
- **One-way operation** - cannot reverse hash back to original text
- **Collision-resistant** - SHA-256 makes it computationally infeasible to find two different inputs with the same hash
- **Used for**: Hashing copy/paste content before sending to server, matching pastes to copies

## Related Spec

- **Vision.md**: Section "Copy / Paste Monitoring" - defines SHA-256 hashing requirement
- **Vision.md**: Section "Security & Privacy" - specifies SHA-256 as the hashing algorithm
- **Plan.md**: Phase 1 Task 1.2 - "Implement `crypto.ts` — SHA-256 hashing via Web Crypto API"

## Implementation Notes

- Uses `TextEncoder` to convert string to UTF-8 bytes before hashing
- Converts hash buffer to hex string using efficient lookup table
- Extracted `bytesToHex` helper for clarity and potential reuse
- Works in both Deno and browser environments (both provide Web Crypto API)
