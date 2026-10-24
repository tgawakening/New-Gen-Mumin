# Node.js security update — 23 October 2026

Status: source configuration prepared; production runtime, deployment, logs and credentials have not been inspected or changed.

The October 21 Node.js security release fixes CVE-2026-111497 and other issues:
https://nodejs.org/en/blog/vulnerability/october-2026-security-releases

Production was reported as Node.js 22.22.2 in the DigitalOcean console. This project requests Node.js >=22.23.4 <23 in package.json, retaining the existing production major version. The .nvmrc file selects 22.23.4 for nvm users. These files do not update an already running server. npm may only warn about an incompatible runtime.

## DigitalOcean App Platform

1. Deploy the reviewed runtime configuration from the application's actual source repository. Avoid deploying unrelated local work.
2. Rebuild the web service and every Node.js worker. Confirm the build log selects Node.js 22.23.4 or a newer 22.x release. If unavailable, ask DigitalOcean to provide the patched runtime; do not lower the required version.
3. In each running component's console, run `node -v` and confirm the patched version. A successful source edit or build alone is not proof that production is patched.
4. Test login, checkout using test mode, and webhook handling. Do not create live charges as a security test.

App Platform reads engines.node from package.json:
https://docs.digitalocean.com/products/app-platform/reference/buildpacks/nodejs/

## Droplet or container

Identify the current runtime installation method and service manager first. Upgrade using that installation method, or rebuild the container with a patched Node.js image. Restart all app and worker processes, then verify the runtime used by those processes. A different Node.js binary in an interactive shell does not establish that the service has been updated.

## Security review

Review hosting access/application logs and Stripe API activity for suspicious requests, crashes, access or transactions. The Stripe account may also be used by applications other than Gen-M; inventory those separately. A warning does not establish a compromise. If compromise is suspected, contain and rebuild the affected environment before issuing replacement Stripe secret keys and other credentials. Deploy replacements and retire the old keys, verifying payment and webhook operation. Never place secret keys in source control or chat.
