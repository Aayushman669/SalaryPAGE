export type SupportedUploadMimeType =
  | "application/pdf"
  | "image/jpeg"
  | "image/png"
  | "image/webp";

function startsWithBytes(bytes: Uint8Array, expected: readonly number[]) {
  return expected.every((byte, index) => bytes[index] === byte);
}

export async function validateUploadFileSignature(
  file: Blob,
  mimeType: SupportedUploadMimeType,
) {
  try {
    const bytes = new Uint8Array(await file.slice(0, 12).arrayBuffer());

    const valid =
      mimeType === "application/pdf"
        ? startsWithBytes(bytes, [0x25, 0x50, 0x44, 0x46, 0x2d])
        : mimeType === "image/jpeg"
          ? startsWithBytes(bytes, [0xff, 0xd8, 0xff])
          : mimeType === "image/png"
            ? startsWithBytes(bytes, [
                0x89,
                0x50,
                0x4e,
                0x47,
                0x0d,
                0x0a,
                0x1a,
                0x0a,
              ])
            :
              startsWithBytes(bytes, [0x52, 0x49, 0x46, 0x46]) &&
              startsWithBytes(bytes.slice(8), [0x57, 0x45, 0x42, 0x50]);

    return valid
      ? null
      : "The selected file contents do not match the allowed file type.";
  } catch {
    return "The selected file could not be verified. Please choose it again.";
  }
}
