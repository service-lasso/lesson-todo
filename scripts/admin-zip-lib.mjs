import { inflateRawSync } from "node:zlib";

export const ADMIN_ZIP_LIMITS = Object.freeze({
  archiveBytes: 64 * 1024 * 1024,
  memberBytes: 64 * 1024 * 1024,
  totalBytes: 256 * 1024 * 1024,
  members: 8192,
  depth: 32,
});

function invalid(reason) { throw Error(`Invalid Admin ZIP: ${reason}`); }

const CRC_TABLE = Array.from({ length: 256 }, (_, value) => {
  let crc = value;
  for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
  return crc >>> 0;
});

function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) crc = (crc >>> 8) ^ CRC_TABLE[(crc ^ byte) & 0xff];
  return (crc ^ 0xffffffff) >>> 0;
}

function memberName(bytes, flags) {
  // Validate the original name before applying the release producer's optional
  // single './' prefix. No backslash/Unicode-extra-field name substitutions.
  const originalName = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  if (!(flags & 0x800) && bytes.some(byte => byte > 0x7f)) invalid("non-UTF8 name");
  if (originalName === "./") return { name: "", originalName, directory: true, parts: [] };
  const name = originalName.startsWith("./") ? originalName.slice(2) : originalName;
  const directory = name.endsWith("/");
  const parts = (directory ? name.slice(0, -1) : name).split("/");
  if (parts.length > ADMIN_ZIP_LIMITS.depth || parts.some(part =>
    !part || part === "." || part === ".." || /[\x00-\x1f\x7f\\:<>"|?*]/.test(part) ||
    /[. ]$/.test(part) || /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(part))) {
    invalid(`unsafe member ${name}`);
  }
  return { name, originalName, directory, parts };
}

// Read only the standard single-disk stored/deflated ZIP contract produced by
// the Admin release. Unsupported ZIP features fail closed, before any writes.
// Format reference: https://pkware.cachefly.net/webdocs/casestudies/APPNOTE.TXT
export function admitAdminZip(bytes) {
  if (bytes.length > ADMIN_ZIP_LIMITS.archiveBytes || bytes.length < 22) invalid("archive size");
  const range = (offset, size, end = bytes.length) => {
    if (!Number.isSafeInteger(offset) || offset < 0 || size < 0 || offset + size > end) invalid("truncated record");
  };
  const extra = (offset, size) => {
    const end = offset + size;
    while (offset < end) {
      range(offset, 4, end);
      const id = bytes.readUInt16LE(offset);
      const length = bytes.readUInt16LE(offset + 2);
      range(offset + 4, length, end);
      if (id === 1) invalid("ZIP64 extra field");
      offset += 4 + length;
    }
  };
  let end = -1;
  for (let offset = bytes.length - 22; offset >= Math.max(0, bytes.length - 65557); offset -= 1) {
    if (bytes.readUInt32LE(offset) === 0x06054b50 && offset + 22 + bytes.readUInt16LE(offset + 20) === bytes.length) {
      end = offset; break;
    }
  }
  if (end < 0) invalid("missing end record");
  const count = bytes.readUInt16LE(end + 10);
  const centralSize = bytes.readUInt32LE(end + 12);
  const central = bytes.readUInt32LE(end + 16);
  if (bytes.readUInt16LE(end + 4) || bytes.readUInt16LE(end + 6) ||
      bytes.readUInt16LE(end + 8) !== count || !count || count > ADMIN_ZIP_LIMITS.members ||
      central + centralSize !== end) invalid("unsupported central directory");
  const members = [];
  const names = new Map();
  const prefixes = new Map();
  let cursor = central;
  let total = 0;
  for (let index = 0; index < count; index += 1) {
    range(cursor, 46, end);
    if (bytes.readUInt32LE(cursor) !== 0x02014b50) invalid("central signature");
    const flags = bytes.readUInt16LE(cursor + 8);
    const method = bytes.readUInt16LE(cursor + 10);
    const crc = bytes.readUInt32LE(cursor + 16);
    const compressed = bytes.readUInt32LE(cursor + 20);
    const size = bytes.readUInt32LE(cursor + 24);
    const nameSize = bytes.readUInt16LE(cursor + 28);
    const extraSize = bytes.readUInt16LE(cursor + 30);
    const commentSize = bytes.readUInt16LE(cursor + 32);
    range(cursor, 46 + nameSize + extraSize + commentSize, end);
    extra(cursor + 46 + nameSize, extraSize);
    if (bytes.readUInt16LE(cursor + 6) > 20 || (flags & ~0x80e) || ![0, 8].includes(method) || bytes.readUInt16LE(cursor + 34) ||
        size > ADMIN_ZIP_LIMITS.memberBytes || compressed > ADMIN_ZIP_LIMITS.archiveBytes) invalid("unsupported member or size");
    total += size;
    if (total > ADMIN_ZIP_LIMITS.totalBytes) invalid("total inflated size");
    const rawName = bytes.subarray(cursor + 46, cursor + 46 + nameSize);
    const member = memberName(rawName, flags);
    const attributes = bytes.readUInt32LE(cursor + 38);
    const type = (attributes >>> 16) & 0xf000;
    if ((type && type !== (member.directory ? 0x4000 : 0x8000)) ||
        (attributes & 0x08) || ((attributes & 0x10) && !member.directory) || (member.directory && size)) invalid("link or special member");
    const key = member.name.replace(/\/$/, "").toLowerCase();
    if (names.has(key)) invalid("duplicate or colliding name");
    names.set(key, member);
    for (let depth = 1; depth <= member.parts.length; depth += 1) {
      const prefix = member.parts.slice(0, depth).join("/");
      const folded = prefix.toLowerCase();
      if (prefixes.has(folded) && prefixes.get(folded) !== prefix) invalid("parent case collision");
      prefixes.set(folded, prefix);
    }
    const local = bytes.readUInt32LE(cursor + 42);
    range(local, 30, central);
    if (bytes.readUInt32LE(local) !== 0x04034b50 || bytes.readUInt16LE(local + 4) !== bytes.readUInt16LE(cursor + 6) || bytes.readUInt16LE(local + 6) !== flags ||
        bytes.readUInt16LE(local + 8) !== method) invalid("local header mismatch");
    const localNameSize = bytes.readUInt16LE(local + 26);
    const localExtraSize = bytes.readUInt16LE(local + 28);
    const dataStart = local + 30 + localNameSize + localExtraSize;
    range(local, 30 + localNameSize + localExtraSize + compressed, central);
    extra(local + 30 + localNameSize, localExtraSize);
    if (!rawName.equals(bytes.subarray(local + 30, local + 30 + localNameSize))) invalid("local name mismatch");
    if (!(flags & 8) && (bytes.readUInt32LE(local + 14) !== crc ||
        bytes.readUInt32LE(local + 18) !== compressed || bytes.readUInt32LE(local + 22) !== size)) invalid("local size mismatch");
    if ((flags & 8) && [[14, crc], [18, compressed], [22, size]].some(([field, value]) =>
      bytes.readUInt32LE(local + field) !== 0 && bytes.readUInt32LE(local + field) !== value)) invalid("local descriptor size mismatch");
    let dataEnd = dataStart + compressed;
    if (flags & 8) {
      range(dataEnd, 12, central);
      const descriptor = bytes.readUInt32LE(dataEnd) === 0x08074b50 ? dataEnd + 4 : dataEnd;
      range(descriptor, 12, central);
      if (bytes.readUInt32LE(descriptor) !== crc || bytes.readUInt32LE(descriptor + 4) !== compressed ||
          bytes.readUInt32LE(descriptor + 8) !== size) invalid("data descriptor mismatch");
      dataEnd = descriptor + 12;
    }
    members.push({ ...member, local, dataStart, dataEnd, compressed, size, crc, method });
    cursor += 46 + nameSize + extraSize + commentSize;
  }
  if (cursor !== end) invalid("extra central records");
  let previous = 0;
  for (const member of [...members].sort((a, b) => a.local - b.local)) {
    if (member.local !== previous) invalid("extra or overlapping local records");
    previous = member.dataEnd;
    for (let depth = 1; depth < member.parts.length; depth += 1) {
      const parent = names.get(member.parts.slice(0, depth).join("/").toLowerCase());
      if (parent && (!parent.directory || parent.name.slice(0, -1) !== member.parts.slice(0, depth).join("/"))) invalid("parent collision");
    }
  }
  if (previous !== central) invalid("extra local bytes");
  // Decode one bounded member at a time during extraction; the checksum binds
  // the buffer used for both admission and decompression, without reopening it.
  return members.map(member => ({
    name: member.name,
    directory: member.directory,
    read() {
      const input = bytes.subarray(member.dataStart, member.dataStart + member.compressed);
      const output = member.method === 0 ? input : inflateRawSync(input, { maxOutputLength: Math.max(1, member.size), info: true });
      const data = member.method === 0 ? output : output.buffer;
      if (data.length !== member.size || crc32(data) !== member.crc ||
          (member.method === 8 && output.engine.bytesWritten !== input.length)) invalid(`content mismatch ${member.name}`);
      return data;
    },
  }));
}
