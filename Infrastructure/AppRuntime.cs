namespace WebChat.Infrastructure
{
    public static class AppRuntime
    {
        // Changes on every process start so media URLs can invalidate stale browser range caches.
        public static string InstanceToken { get; } = Guid.NewGuid().ToString("N");
    }
}
