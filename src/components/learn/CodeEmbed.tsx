export default function CodeEmbed({ src }: { src: string }) {
  return (
    <div className="w-full h-[600px] overflow-hidden rounded-lg border border-accent">
      <iframe
        src={src}
        width="100%"
        height="100%"
        frameBorder="0"
        title="Code Editor"
        allow="fullscreen"
      ></iframe>
    </div>
  );
}
