---
name: Launch assurance gates
description: Evidence required to close the owner's privacy and real-provider launch audit.
---
Do not equate fixing application code with completing public-launch assurance. Keep factual processor agreements, deployment regions and transfer/retention verification separate from the owner's assessment of the legal documents.

**Why:** The owner supplied a launch audit that treats unresolved arrangements for PARQ health data as the highest-priority blocker. Removing warnings or asserting generic platform defaults would conceal rather than resolve that finding.

**How to apply:** Clearly separate engineering test results from legal/operator evidence and actual provider journeys. Mock OIDC and billing tests are not real new-user sign-in or sandbox payment acceptance. Provider/infrastructure cookies such as GAESA require provider confirmation; adding an unrelated application cookie is not a safe fix for a cookie injected downstream.

For this project, the owner considers the legal documents fine and explicitly does not require a solicitor. Do not make hiring a solicitor or obtaining solicitor sign-off a condition of further work.

**Why:** On 2026-10-02 the owner clarified, “i do not need a solicitor, thats all fine,” after supplying the additional launch checklist.

**How to apply:** Respect the owner's decision on document review. User-facing acceptance prompts and legal pages should ask readers to review the documents, not present internal owner/solicitor-review instructions or make unconfirmed professional-review claims. Continue practical engineering and provider checks without repeatedly asking for solicitor review. Do not interpret the decision as evidence that hosting locations, processor agreements or live-provider tests have been verified.

Keep public document rendering and the signed-in acceptance prompt as separate test surfaces.

**Why:** A launch check falsely expected the onboarding acceptance sentence inside the public legal documents. Changing the approved documents to satisfy that check would have obscured a test error.

**How to apply:** Validate the actual policy headings and contents on public pages, and validate acceptance prompts where they are shown. Preserve checks against unconfirmed review claims on both surfaces.