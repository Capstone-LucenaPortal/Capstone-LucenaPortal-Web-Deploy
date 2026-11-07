import type { ProgramImageContent } from '@/portals/citizen/features/content/lib/programs';

interface ProgramImageProps {
  image: ProgramImageContent;
  height?: number;
}

/** A program photo, or a striped box holding its space until one is supplied. */
export default function ProgramImage({ image, height = 320 }: ProgramImageProps) {
  if (image.src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={image.src}
        alt={image.alt}
        loading="lazy"
        style={{ width: '100%', height, objectFit: 'cover', display: 'block', borderRadius: 8 }}
      />
    );
  }

  return (
    <div
      role="img"
      aria-label={image.alt}
      style={{
        height,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 12,
        borderRadius: 8,
        border: '1px dashed #9AA9BC',
        background: 'repeating-linear-gradient(45deg, #E8EDF3, #E8EDF3 10px, #F2F5F8 10px, #F2F5F8 20px)',
        color: '#5B6B80',
        fontSize: 13,
        fontWeight: 600,
      }}
    >
      Image placeholder
    </div>
  );
}
