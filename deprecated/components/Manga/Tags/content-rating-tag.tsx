import NormalTag from "./normal-tag";

interface ContentRatingChipProps {
  rating: string;
  disabledLink?: boolean;
}

const ContentRatingChip = ({
  rating,
  disabledLink = false,
}: ContentRatingChipProps) => {
  if (rating === "safe") {
    return null;
  }
  const ratingColor = {
    suggestive: "bg-yellow-500 dark:bg-yellow-400",
    erotica: "bg-red-500 dark:bg-red-400",
    pornographic: "bg-red-800 dark:bg-red-700",
  }[rating];

  return (
    <NormalTag className={`uppercase text-white ${ratingColor}`}>
      {disabledLink ? (
        rating
      ) : (
        <a
          href={`/advanced-search?content=${rating}`}
          className="hover:underline"
        >
          {rating}
        </a>
      )}
    </NormalTag>
  );
};

export default ContentRatingChip;
