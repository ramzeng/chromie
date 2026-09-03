#!/bin/sh

set -eu

project_dir=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
source_svg="$project_dir/resources/chromie-app-icon-knot.svg"
output_png="$project_dir/resources/chromie-app-icon-knot.png"
output_icns="$project_dir/resources/chromie-app-icon-knot.icns"
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
  sips -s format png -z "$pixels" "$pixels" "$source_svg" \
    --out "$iconset_dir/$filename" >/dev/null
}

# Render each ICNS slot directly from the vector source. This avoids asking
# electron-builder to repeatedly downsample one large PNG for smaller icons.
render_icon 16 icon_16x16.png
render_icon 32 icon_16x16@2x.png
render_icon 32 icon_32x32.png
render_icon 64 icon_32x32@2x.png
render_icon 128 icon_128x128.png
render_icon 256 icon_128x128@2x.png
render_icon 256 icon_256x256.png
render_icon 512 icon_256x256@2x.png
render_icon 512 icon_512x512.png
render_icon 1024 icon_512x512@2x.png

iconutil -c icns "$iconset_dir" -o "$icon_tmp_dir/Chromie.icns"
cp "$iconset_dir/icon_512x512@2x.png" "$output_png"
cp "$icon_tmp_dir/Chromie.icns" "$output_icns"

echo "Generated $output_png and $output_icns"
