import { useState } from "react"
import { Content } from "@tiptap/react"
import { MinimalTiptapEditor } from "../minimal-tiptap"

export const NewEditor = () => {
  const [value, setValue] = useState<Content>("")
  console.log(value)

  return (
    <MinimalTiptapEditor
      value={value}
      onChange={setValue}
      className="w-full"
      editorContentClassName="p-5"
      output="html"
      placeholder="Viết bình luận..."
      autofocus={false}
      editable={true}
      editorClassName="focus:outline-hidden"
    />
  )
}