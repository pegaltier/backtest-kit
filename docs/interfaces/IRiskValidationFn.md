---
title: docs/interface/IRiskValidationFn
group: docs
---

# IRiskValidationFn

Risk validation function type.
Returns null/void if validation passes, IRiskRejectionResult if validation fails.
Can also throw error which will be caught and converted to IRiskRejectionResult.
