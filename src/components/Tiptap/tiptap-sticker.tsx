import { Image } from "@tiptap/extension-image";

export const TiptapSticker = Image.extend({
	addAttributes() {
		return {
			...this.parent?.(),
			isSticker: {
				default: false,
				parseHTML: (element) => element.getAttribute("data-sticker") === "true",
				renderHTML: (attributes) => {
					if (attributes.isSticker) {
						return {
							"data-sticker": "true",
							class: "sticker-image",
							style: "width:150px; height: auto;",
							width: "150",
							height: "auto",
						};
					}
					return {};
				},
			},
		};
	},
});
