#!/bin/sh

set -eu

if [ "$#" -gt 1 ]; then
  echo "Usage: $0 [Chromie.app]" >&2
  exit 2
fi

project_dir=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
source_png="$project_dir/resources/chromie-app-icon-knot.png"
source_icns="$project_dir/resources/chromie-app-icon-knot.icns"
source_svg="$project_dir/resources/chromie-app-icon-knot.svg"
composer_package="$project_dir/resources/Chromie.icon"
composer_json="$composer_package/icon.json"
composer_svg="$composer_package/Assets/chromie-knot.svg"
icon_tmp_dir=$(mktemp -d "${TMPDIR:-/tmp}/chromie-icon-verify.XXXXXX")
iconset_dir="$icon_tmp_dir/Chromie.iconset"

cleanup() {
  rm -rf -- "$icon_tmp_dir"
}

trap cleanup EXIT HUP INT TERM

for asset_path in "$source_png" "$source_icns" "$source_svg" "$composer_json" "$composer_svg"; do
  if [ ! -s "$asset_path" ]; then
    echo "Missing macOS icon asset: $asset_path" >&2
    exit 1
  fi
done

node - "$composer_json" "$source_svg" "$composer_svg" <<'NODE'
const fs = require('node:fs')

const [composerJsonPath, sourceSvgPath, composerSvgPath] = process.argv.slice(2)
const icon = JSON.parse(fs.readFileSync(composerJsonPath, 'utf8'))

function assert(condition, message) {
  if (!condition) {
    console.error(message)
    process.exit(1)
  }
}

const group = icon.groups?.[0]
const layer = group?.layers?.[0]

assert(icon.groups?.length === 1, 'Chromie.icon must contain exactly one artwork group.')
assert(group?.layers?.length === 1, 'Chromie.icon must contain exactly one artwork layer.')
assert(
  icon.fill?.solid === 'extended-srgb:0.96863,0.96863,0.96078,1.00000',
  'Chromie.icon background must match the development icon (#f7f7f5).',
)
assert(layer?.['image-name'] === 'chromie-knot.svg', 'Chromie.icon references the wrong artwork asset.')
assert(layer?.glass === false, 'Chromie.icon artwork must have Liquid Glass disabled.')
assert(group?.shadow?.kind === 'none' && group.shadow.opacity === 0, 'Chromie.icon shadow must be disabled.')
assert(
  group?.translucency?.enabled === false && group.translucency.value === 0,
  'Chromie.icon translucency must be disabled.',
)

function pathAttributes(svgPath) {
  const svg = fs.readFileSync(svgPath, 'utf8')
  const pathTag = svg.match(/<path\b[^>]*>/)?.[0]
  assert(pathTag, `Missing path element in ${svgPath}`)

  return Object.fromEntries(
    ['d', 'transform', 'fill', 'stroke', 'stroke-width', 'stroke-linecap', 'stroke-linejoin'].map((name) => {
      const value = pathTag.match(new RegExp(`\\b${name}="([^"]*)"`))?.[1]
      assert(value !== undefined, `Missing ${name} on the knot path in ${svgPath}`)
      return [name, value]
    }),
  )
}

assert(
  JSON.stringify(pathAttributes(sourceSvgPath)) === JSON.stringify(pathAttributes(composerSvgPath)),
  'Chromie.icon knot geometry or styling differs from the development icon.',
)
NODE

iconutil -c iconset "$source_icns" -o "$iconset_dir"

verify_slot() {
  filename=$1
  expected_pixels=$2
  image_path="$iconset_dir/$filename"

  if [ ! -s "$image_path" ]; then
    echo "ICNS is missing $filename" >&2
    exit 1
  fi

  actual_dimensions=$(
    sips -g pixelWidth -g pixelHeight "$image_path" 2>/dev/null |
      awk '
        /pixelWidth:/ { width = $2 }
        /pixelHeight:/ { height = $2 }
        END { print width "x" height }
      '
  )
  expected_dimensions="${expected_pixels}x${expected_pixels}"

  if [ "$actual_dimensions" != "$expected_dimensions" ]; then
    echo "$filename is $actual_dimensions; expected $expected_dimensions" >&2
    exit 1
  fi
}

verify_slot icon_16x16.png 16
verify_slot icon_16x16@2x.png 32
verify_slot icon_32x32.png 32
verify_slot icon_32x32@2x.png 64
verify_slot icon_128x128.png 128
verify_slot icon_128x128@2x.png 256
verify_slot icon_256x256.png 256
verify_slot icon_256x256@2x.png 512
verify_slot icon_512x512.png 512
verify_slot icon_512x512@2x.png 1024

if ! cmp -s "$source_png" "$iconset_dir/icon_512x512@2x.png"; then
  echo "The development PNG does not match the ICNS 1024px representation." >&2
  echo "Run npm run icons:mac and commit both generated assets." >&2
  exit 1
fi

if [ "$#" -eq 1 ]; then
  app_path=$1
  info_plist="$app_path/Contents/Info.plist"

  if [ ! -f "$info_plist" ]; then
    echo "Not a macOS app bundle: $app_path" >&2
    exit 1
  fi

  bundle_icon_name=$(/usr/libexec/PlistBuddy -c 'Print :CFBundleIconFile' "$info_plist")
  case "$bundle_icon_name" in
    *.icns) ;;
    *) bundle_icon_name="${bundle_icon_name}.icns" ;;
  esac
  bundle_icon="$app_path/Contents/Resources/$bundle_icon_name"
  bundle_dock_icon="$app_path/Contents/Resources/chromie-app-icon-knot.png"
  bundle_asset_catalog="$app_path/Contents/Resources/Assets.car"
  composer_icon_name=$(/usr/libexec/PlistBuddy -c 'Print :CFBundleIconName' "$info_plist" 2>/dev/null || true)

  if [ ! -f "$bundle_icon" ]; then
    echo "App bundle icon is missing: $bundle_icon" >&2
    exit 1
  fi

  if [ ! -f "$bundle_dock_icon" ]; then
    echo "App bundle Dock icon is missing: $bundle_dock_icon" >&2
    exit 1
  fi

  if [ "$composer_icon_name" != "Icon" ]; then
    echo "App bundle does not select the Icon Composer asset catalog." >&2
    exit 1
  fi

  if [ ! -s "$bundle_asset_catalog" ]; then
    echo "App bundle Icon Composer catalog is missing: $bundle_asset_catalog" >&2
    exit 1
  fi

  if ! cmp -s "$source_png" "$bundle_dock_icon"; then
    echo "App bundle Dock icon differs from the committed macOS PNG." >&2
    exit 1
  fi

  echo "Verified flat Icon Composer settings, legacy icon slots, and bundled assets in $app_path"
else
  echo "Verified flat Icon Composer settings and all macOS icon slots in $source_icns"
fi
