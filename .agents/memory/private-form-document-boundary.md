---
name: Private form document boundary
description: Why modest private uploads stay within the existing storage boundary, and what file validation does not prove.
---
Prefer bounded storage in the existing database for modest client-form uploads rather than introducing another storage processor without a clear scaling need.

**Why:** Forms may contain sensitive health information. Reusing the established data boundary avoids an additional provider/privacy arrangement and keeps ownership and record deletion consistent. This is a deliberate privacy-and-simplicity tradeoff, not a recommendation for unlimited large-file storage.

**How to apply:** Preserve private authenticated coach downloads, bounded uploads, and deletion with the associated records. Revisit storage deliberately if document volume becomes unsuitable for database storage; do not silently introduce public or externally shareable download URLs.

Format and signature checks are not malware scanning, verified client identity, a verified signature, or medical-compliance certification.

**Why:** A permitted PDF or Word document can still contain malicious content, and a bearer form link only proves possession of that link.

**How to apply:** Describe these safeguards accurately. A malware-scanning integration is a separate capability, and sending potentially sensitive documents to a new scanner requires reviewing that processor boundary.
