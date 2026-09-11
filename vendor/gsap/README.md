# GSAP (vendored locally)

Source: https://unpkg.com/gsap@3.13.0/dist/gsap.min.js
        https://unpkg.com/gsap@3.13.0/dist/ScrollTrigger.min.js
Version: 3.13.0
License: Webflow GSAP Software License Agreement / current GSAP standard license.
Reference: https://webflow.com/legal/product-terms and https://gsap.com/standard-license
Current terms permit implementation/use of GSAP on websites and web applications;
the principal prohibited use is building a competing no-code visual animation builder.

Vendored instead of loaded from a third-party CDN (cdnjs) to remove the runtime
third-party network dependency on the public-facing pages. No build step or npm
install is required — these are the plain UMD builds, referenced directly via
`<script src="vendor/gsap/...">`.

To update: replace these two .js (+ .map) files with a newer version's UMD build
and update this README's version number. Do not edit the files by hand.
