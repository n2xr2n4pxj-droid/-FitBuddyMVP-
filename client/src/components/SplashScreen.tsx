export default function SplashScreen() {
  return (
    <div className="min-h-screen bg-blue-600 flex items-center justify-center">
      <div className="text-center text-white">
        <h1 className="text-3xl font-bold tracking-wide">FitBuddy</h1>
        <div className="mt-4 flex justify-center">
          <span className="h-8 w-8 rounded-full border-4 border-white/40 border-t-white animate-spin" />
        </div>
      </div>
    </div>
  );
}
