# Giftborne Preview

Public static runtime for the Giftborne Telegram Mini App.

This deployment contains compiled browser assets only. Its source build is
tracked in the private `tibetano93/giftborne` repository.

The published artifact must come from `apps/miniapp/dist-pages`, produced by
`pnpm build:pages`. The default root-hosted `dist` build is not valid for this
repository's `/giftborne-preview/` subpath.
