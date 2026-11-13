using Xunit;

namespace PulsNext.Infrastructure.Tests;

public sealed class ChatPresenceTrackerTests
{
    [Fact]
    public void UserIsOnlineWhileAnyConnectionIsOpen()
    {
        var tracker = new ChatPresenceTracker();

        Assert.True(tracker.Connect(1, "tab-1"));
        Assert.False(tracker.Connect(1, "tab-2"));
        Assert.False(tracker.Connect(1, "tab-2"));
        Assert.True(tracker.IsOnline(1));

        Assert.False(tracker.Disconnect(1, "tab-1"));
        Assert.True(tracker.IsOnline(1));

        Assert.True(tracker.Disconnect(1, "tab-2"));
        Assert.False(tracker.IsOnline(1));
        Assert.False(tracker.Disconnect(1, "tab-2"));
    }

    [Fact]
    public void FilterOnline_ReturnsOnlyConnectedUsers()
    {
        var tracker = new ChatPresenceTracker();
        tracker.Connect(1, "a");
        tracker.Connect(3, "b");

        Assert.Equal([1, 3], tracker.FilterOnline([1, 2, 3, 3]).Order());
    }

    [Fact]
    public async Task ConcurrentConnectAndDisconnect_KeepsCountsConsistent()
    {
        var tracker = new ChatPresenceTracker();
        await Task.WhenAll(Enumerable.Range(0, 200).Select(i => Task.Run(() =>
        {
            tracker.Connect(7, $"c{i}");
            if (i % 2 == 0)
            {
                tracker.Disconnect(7, $"c{i}");
            }
        })));

        Assert.True(tracker.IsOnline(7));
        for (var i = 1; i < 200; i += 2)
        {
            tracker.Disconnect(7, $"c{i}");
        }

        Assert.False(tracker.IsOnline(7));
    }
}
