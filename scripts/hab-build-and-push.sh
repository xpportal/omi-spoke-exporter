#!/bin/bash

export BASE_ASSETS_PATH=$1
export RETICULUM_SERVER=$2
export FARSPARK_SERVER=$3
export CORS_PROXY_SERVER=$4
export NON_CORS_PROXY_DOMAINS=$5
export SENTRY_DSN=$6
export SENTRY_AUTH_TOKEN=$7
export SENTRY_URL=$8
export SENTRY_ORG=$9
export SENTRY_PROJECT=${10}
export TARGET_S3_URL=${11}
export BUILD_NUMBER=${12}
export GIT_COMMIT=${13}
export BUILD_VERSION="${BUILD_NUMBER} (${GIT_COMMIT})"

# To build + push to S3 run:
# hab studio run "bash scripts/hab-build-and-push.sh"
# On exit, need to make all files writable so CI can clean on next build

trap 'chmod -R a+rw .' EXIT

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

pushd "$DIR/.."

rm /usr/bin/env
ln -s "$(hab pkg path core/coreutils)/bin/env" /usr/bin/env
hab pkg install -b core/coreutils core/bash core/node10 core/git core/aws-cli core/python2

npm config set cache "$(pwd)/.npm" # Set the npm cache to a directory in the current workspace so that it can be reused across ci builds
npm ci --verbose --no-progress
npm run build
mkdir -p dist/pages
mv dist/*.html dist/pages

# we need to upload wasm blobs with wasm content type explicitly because, unlike all our
# other assets, AWS's built-in MIME type dictionary doesn't know about that one
aws s3 sync --acl public-read --cache-control "max-age=31556926" --include "*" --exclude "*.wasm" dist/assets "$TARGET_S3_URL/spoke/assets"
aws s3 sync --acl public-read --cache-control "max-age=31556926" --exclude "*" --include "*.wasm" --content-type "application/wasm" dist/assets "$TARGET_S3_URL/spoke/assets"

aws s3 sync --acl public-read --cache-control "no-cache" --delete dist/pages "$TARGET_S3_URL/spoke/pages/latest"
aws s3 sync --acl public-read --cache-control "no-cache" --delete dist/pages "$TARGET_S3_URL/spoke/pages/releases/${BUILD_NUMBER}"
