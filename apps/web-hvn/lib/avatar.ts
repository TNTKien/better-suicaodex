export function hvnAvatarSrc(image: string | null | undefined) {
  // Google's initials avatars have a URL even when no profile photo is set.
  return !image || /^https:\/\/lh\d+\.googleusercontent\.com\/a\//i.test(image)
    ? "/brand/mac_dinh.webp"
    : image
}
