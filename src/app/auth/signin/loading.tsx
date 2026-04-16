export default function SignInLoading() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50/50 dark:bg-background">
      <div className="w-full max-w-sm space-y-6 animate-pulse">
        <div className="h-8 w-32 bg-muted rounded mx-auto" />
        <div className="h-10 bg-muted rounded" />
        <div className="h-10 bg-muted rounded" />
        <div className="h-10 bg-muted rounded" />
        <div className="h-10 bg-primary/30 rounded" />
      </div>
    </div>
  );
}
