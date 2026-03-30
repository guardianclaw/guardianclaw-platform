// Builder has its own layout that doesn't require auth
// The builder page manages its own header (BuilderHeader) with specific controls
// This layout is minimal to avoid conflicts with the builder's full-screen design
export default function BuilderLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
