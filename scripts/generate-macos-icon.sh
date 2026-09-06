#!/bin/sh

set -eu

# This is an asset-authoring command. Commit its output so development, legacy
# macOS/DMG icons, and the modern Icon Composer package share reviewed artwork.
project_dir=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
source_svg="$project_dir/resources/chromie-app-icon-knot.svg"
output_png="$project_dir/resources/chromie-app-icon-knot.png"
output_icns="$project_dir/resources/chromie-app-icon-knot.icns"
composer_svg="$project_dir/resources/Chromie.icon/Assets/chromie-knot.svg"
icon_tmp_dir=$(mktemp -d "${TMPDIR:-/tmp}/chromie-icon.XXXXXX")
iconset_dir="$icon_tmp_dir/Chromie.iconset"

cleanup() {
  rm -rf -- "$icon_tmp_dir"
}

trap cleanup EXIT HUP INT TERM
mkdir -p "$iconset_dir"

render_icon() {
  pixels=$1
  filename=$2
  stroke_width=$3
  optical_svg="$icon_tmp_dir/chromie-app-icon-stroke-$stroke_width.svg"

  if [ ! -f "$optical_svg" ]; then
    sed "s/stroke-width=\"48\"/stroke-width=\"$stroke_width\"/" \
      "$source_svg" > "$optical_svg"
    if ! grep -q "stroke-width=\"$stroke_width\"" "$optical_svg"; then
      echo "Could not apply optical stroke width $stroke_width" >&2
      exit 1
    fi
  fi

  sips -s format png -z "$pixels" "$pixels" "$optical_svg" \
    --out "$iconset_dir/$filename" >/dev/null
}

# Render every ICNS representation from vector artwork. Small logical sizes use
# heavier optical strokes so the knot stays dark after macOS anti-aliasing.
render_icon 16 icon_16x16.png 72
render_icon 32 icon_16x16@2x.png 72
render_icon 32 icon_32x32.png 56
render_icon 64 icon_32x32@2x.png 56
render_icon 128 icon_128x128.png 48
render_icon 256 icon_128x128@2x.png 48
render_icon 256 icon_256x256.png 48
render_icon 512 icon_256x256@2x.png 48
render_icon 512 icon_512x512.png 48
render_icon 1024 icon_512x512@2x.png 48

iconutil -c icns "$iconset_dir" -o "$icon_tmp_dir/Chromie.icns"
cp "$iconset_dir/icon_512x512@2x.png" "$output_png"
cp "$icon_tmp_dir/Chromie.icns" "$output_icns"
sed \
  -e '/<title /d' \
  -e '/<rect /d' \
  -e 's/ role="img" aria-labelledby="title"//' \
  "$source_svg" > "$composer_svg"

echo "Generated $output_png, $output_icns, and $composer_svg"
