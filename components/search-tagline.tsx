import type { Messages } from "@/get-dictionary";

export function SearchTagline({ dictionary }: { dictionary: Messages }) {
  const tagline = dictionary.header["search-tagline"];

  return (
    <p className="text-muted-foreground text-lg md:text-xl leading-relaxed text-balance max-w-md mx-auto pe-[0.125em]">
      {tagline.opening}{" "}
      <span className="inline-block max-w-full wrap-anywhere [word-break:keep-all]">
        {tagline.ending}
        <span className="inline-block w-0 text-start">
          {tagline.punctuation}
        </span>
      </span>
    </p>
  );
}
