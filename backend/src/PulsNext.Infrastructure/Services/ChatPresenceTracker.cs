namespace PulsNext.Infrastructure;

/// <summary>
/// Подключения пользователей к хабу в этом процессе API. У одного пользователя может быть несколько вкладок.
/// </summary>
public sealed class ChatPresenceTracker
{
    private readonly object _sync = new();
    private readonly Dictionary<int, HashSet<string>> _connections = new();

    /// <summary>
    /// Регистрирует подключение. Возвращает true, если пользователь только что появился в сети.
    /// </summary>
    public bool Connect(int userId, string connectionId)
    {
        lock (_sync)
        {
            if (!_connections.TryGetValue(userId, out var set))
            {
                set = new HashSet<string>();
                _connections[userId] = set;
            }

            return set.Add(connectionId) && set.Count == 1;
        }
    }

    /// <summary>
    /// Убирает подключение. Возвращает true, если у пользователя не осталось подключений.
    /// </summary>
    public bool Disconnect(int userId, string connectionId)
    {
        lock (_sync)
        {
            if (!_connections.TryGetValue(userId, out var set) || !set.Remove(connectionId))
            {
                return false;
            }

            if (set.Count > 0)
            {
                return false;
            }

            _connections.Remove(userId);
            return true;
        }
    }

    public bool IsOnline(int userId)
    {
        lock (_sync)
        {
            return _connections.ContainsKey(userId);
        }
    }

    public IReadOnlyCollection<int> FilterOnline(IEnumerable<int> userIds)
    {
        lock (_sync)
        {
            return userIds.Distinct().Where(_connections.ContainsKey).ToArray();
        }
    }
}
