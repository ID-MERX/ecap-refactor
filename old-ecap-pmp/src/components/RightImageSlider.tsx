import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

type SliderImage = {
  src: string;
  alt?: string;
};

type RightImageSliderProps = {
  images: SliderImage[];
  className?: string;
  intervalMs?: number;
};

const RightImageSlider = ({ images, className, intervalMs = 7000 }: RightImageSliderProps) => {
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    if (images.length <= 1) {
      return;
    }

    const intervalId = window.setInterval(() => {
      setActiveIndex((current) => (current + 1) % images.length);
    }, intervalMs);

    return () => window.clearInterval(intervalId);
  }, [images.length, intervalMs]);

  return (
    <div className={cn("absolute inset-0", className)} aria-hidden="true">
      {images.map((image, index) => (
        <img
          key={image.src}
          src={image.src}
          alt={image.alt ?? ""}
          className={cn(
            "absolute inset-0 h-full w-full object-cover transition-opacity duration-700",
            index === activeIndex ? "opacity-80" : "opacity-0",
          )}
        />
      ))}
      <div className="absolute inset-0 bg-gradient-to-t from-slate-900/70 via-slate-900/20 to-transparent" />
      <a
        href="https://www.pexels.com/photo/cheerful-black-children-standing-on-sandy-ground-5196015/"
        target="_blank"
        rel="noopener noreferrer"
        className="absolute bottom-2 left-10 z-10 text-[10px] leading-tight text-white/50 hover:text-white/70 transition-colors"
        style={{ maxWidth: "60%" }}
      >
        Photos free to use · Pexels · Lagos Food Bank Initiative, Curtis Loy
      </a>
      {images.length > 1 && (
        <div className="absolute right-6 top-1/2 z-10 flex -translate-y-1/2 flex-col gap-2">
          {images.map((image, index) => (
            <button
              key={`${image.src}-control`}
              type="button"
              aria-label={`Show slide ${index + 1}`}
              onClick={() => setActiveIndex(index)}
              className={cn(
                "h-10 w-1.5 rounded-full transition-colors",
                index === activeIndex ? "bg-white" : "bg-white/40 hover:bg-white/70",
              )}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default RightImageSlider;
