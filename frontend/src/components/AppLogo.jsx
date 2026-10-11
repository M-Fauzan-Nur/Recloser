export default function AppLogo({ width = 36, height = 36, style = {} }) {
  return (
    <img
      src="/logo.png"
      alt="Puslitbang Energi dan Ketenagalistrikan"
      width={width}
      height={height}
      style={{ objectFit: 'contain', borderRadius: 4, ...style }}
    />
  );
}
