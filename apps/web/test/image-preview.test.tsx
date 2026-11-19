import assert from "node:assert/strict"
import { isValidElement, type JSX } from "react"
import { renderToStaticMarkup } from "react-dom/server"

import { AssetImage } from "@workspace/ui/components/asset-image"
import { DialogContent } from "@workspace/ui/components/dialog"
import { ImagePreview } from "@workspace/ui/components/image-preview"

const props = {
  alt: "Bìa truyện <script>",
  src: "https://images.test/cover.webp",
  fallbackSrc: "https://images.test/cover.512.webp",
  width: 700,
  height: 1000,
  children: (
    <AssetImage
      alt="Bìa truyện <script>"
      src="https://images.test/cover.512.webp"
      srcSet="https://images.test/cover.256.webp 256w, https://images.test/cover.512.webp 512w"
      sizes="208px"
      width={700}
      height={1000}
      eager
    />
  ),
}
const closed = renderToStaticMarkup(<ImagePreview {...props} />)
assert.match(
  closed,
  /<button[^>]*aria-label="Phóng to Bìa truyện &lt;script&gt;"/
)
assert.match(closed, /aria-haspopup="dialog"/)
assert.match(closed, /srcSet="[^"]+256w, [^"]+512w"/)
assert.match(closed, /sizes="208px"/)
assert.match(closed, /loading="eager"/)
assert.doesNotMatch(closed, /https:\/\/images\.test\/cover\.webp/)
assert.doesNotMatch(closed, /role="dialog"|data-slot="spinner"|<script>/)

// The real dialog portal stays unmounted until opened. Check its image source separately.
const preview = ImagePreview(props)
assert.ok(isValidElement<{ children: JSX.Element[] }>(preview))
const content = preview.props.children.find(
  (child) => child.type === DialogContent
)
assert.ok(content)
const frame = content.props.children[1]
const image = frame.props.children
assert.equal(image.type, AssetImage)
assert.equal(image.props.src, props.src)
assert.equal(image.props.fallbackSrc, props.fallbackSrc)
assert.equal(
  image.props.srcSet,
  undefined,
  "the viewer must use the full cover"
)
assert.equal(image.props.showSpinner, true)
assert.equal(image.props.fadeIn, true)
assert.match(
  renderToStaticMarkup(image),
  /src="https:\/\/images.test\/cover.webp"/
)

const missing = renderToStaticMarkup(
  <ImagePreview {...props} src={null} fallbackSrc={null}>
    <AssetImage alt="Bìa truyện" src={null} width={700} height={1000} />
  </ImagePreview>
)
assert.match(missing, /aria-label="Bìa truyện chưa có ảnh"/)
assert.doesNotMatch(missing, /<button|aria-haspopup/)
console.log(
  "Cover preview keeps responsive thumbnails and defers full images to the dialog"
)
