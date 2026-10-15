import Image from "next/image";
import { BRAND_NAME } from "@/lib/brand";

type PolleRgiesWordmarkProps = {
  className?: string;
};

/** The selected charcoal-and-red PolleRgies microscope wordmark. */
export default function PolleRgiesWordmark({
  className = "",
}: PolleRgiesWordmarkProps) {
  return (
    <span
      role="img"
      aria-label={BRAND_NAME}
      className={`polle-rgies-wordmark relative inline-block h-[2em] w-[7.7em] shrink-0 overflow-hidden bg-transparent ${className}`}
    >
      <Image
        src="/brand/poller-gies-wordmark-microscope.png"
        alt=""
        fill
        sizes="(max-width: 640px) 210px, 240px"
        className="polle-rgies-wordmark-image polle-rgies-wordmark-image--light object-cover object-[50%_42%]"
      />
      <Image
        src="/brand/poller-gies-wordmark-dark.png"
        alt=""
        fill
        sizes="(max-width: 640px) 210px, 240px"
        className="polle-rgies-wordmark-image polle-rgies-wordmark-image--dark object-cover object-[50%_42%]"
      />
    </span>
  );
}
