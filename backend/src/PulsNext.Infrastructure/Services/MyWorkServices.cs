using DevExpress.Xpo;
using PulsNext.Domain.Legacy;
using PulsNext.Infrastructure.Internal;

namespace PulsNext.Infrastructure;

/// <summary>
/// Задачи сотрудника для дашборда: открытые поручения ему и от него (таблица Пульса set_Job, только чтение).
/// </summary>
public sealed class MyWorkDto
{
    /// <summary>
    /// Открытые поручения сотруднику: сначала с ближайшим сроком (просроченные — первыми), без срока — в конце.
    /// </summary>
    public IReadOnlyCollection<WorkItemDto> Assigned { get; set; } = Array.Empty<WorkItemDto>();
    public int AssignedTotal { get; set; }
    /// <summary>
    /// Сколько из открытых поручений сотруднику уже просрочено.
    /// </summary>
    public int Overdue { get; set; }
    /// <summary>
    /// Открытые поручения, которые сотрудник дал другим.
    /// </summary>
    public IReadOnlyCollection<WorkItemDto> Delegated { get; set; } = Array.Empty<WorkItemDto>();
    public int DelegatedTotal { get; set; }
}

public interface IMyWorkService
{
    MyWorkDto Get(int take);
}

public sealed class MyWorkService(LegacyUnitOfWork legacyUnitOfWork, ICurrentUserAccessor currentUserAccessor, TimeProvider? timeProvider = null) : IMyWorkService
{
    public const int MaxTake = 50;

    public MyWorkDto Get(int take)
    {
        var me = currentUserAccessor.GetLegacyUserId() ?? throw new UnauthorizedAccessException("Пользователь не определен.");
        var limit = take <= 0 ? 10 : Math.Min(take, MaxTake);
        // Сроки в Пульсе — местное время сервера, без часового пояса: сравниваем с местной датой.
        var today = (timeProvider ?? TimeProvider.System).GetLocalNow().Date;

        // Отбор по сотруднику — в SQL; открытость (нет даты выполнения) — в памяти: пустая дата в Пульсе хранится по-разному.
        var assigned = new XPQuery<LegacyJob>(legacyUnitOfWork)
            .Where(x => x.UserTo != null && x.UserTo.Oid == me)
            .ToList()
            .Where(IsOpen)
            .OrderBy(x => DueDate(x) is null)
            .ThenBy(x => DueDate(x) ?? DateTime.MaxValue)
            .ThenByDescending(x => x.Oid)
            .ToList();
        var delegated = new XPQuery<LegacyJob>(legacyUnitOfWork)
            .Where(x => x.UserFrom != null && x.UserFrom.Oid == me && (x.UserTo == null || x.UserTo.Oid != me))
            .ToList()
            .Where(IsOpen)
            .OrderBy(x => DueDate(x) is null)
            .ThenBy(x => DueDate(x) ?? DateTime.MaxValue)
            .ThenByDescending(x => x.Oid)
            .ToList();

        return new MyWorkDto
        {
            Assigned = assigned.Take(limit).Select(MappingHelper.ToWorkDto).ToArray(),
            AssignedTotal = assigned.Count,
            Overdue = assigned.Count(x => DueDate(x) is { } due && due.Date < today),
            Delegated = delegated.Take(limit).Select(MappingHelper.ToWorkDto).ToArray(),
            DelegatedTotal = delegated.Count
        };
    }

    private static bool IsOpen(LegacyJob job) => DateTimeHelper.NullIfMin(job.DateCompleted) is null;

    private static DateTime? DueDate(LegacyJob job) => DateTimeHelper.NullIfMin(job.DateTo);
}
